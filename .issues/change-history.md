# Change history — a server-side, schema-drift-proof audit log per dictionary

Let editors **peruse the history of a record's changes and who made them** — for entries, texts,
and sentences (the three "ruling princes"; entry is no longer king). Server-only, pulled on demand,
**no client sync, no local-first** — it never touches wa-sqlite, the sync engine, or R2 snapshots.

> **Decided with Jacob (this thread):**
> - **Append-only audit log**, NOT event-sourcing-as-source-of-truth (overkill, "we're not a bank")
>   and NOT CRDTs (no merge conflicts to solve — one authoritative server, LWW already chosen).
> - **Captured at the single server merge chokepoint** (`process_dict_changes` / `merge_dict_row`),
>   so zero client changes and every real edit is caught in one place.
> - **Lives in a separate per-dict file `dictionaries/{id}.history.db`**, appended right AFTER the
>   merge transaction commits (best-effort — see "Atomicity" — keeps the main db + viewer snapshots
>   lean forever).
> - **Two tables: `changes` + `change_owners`** (a many-to-many "which prince" index). A single
>   change can belong to several owners; new owner types later are just a new string, never a
>   migration.
> - **Payload = full after-image `snapshot` (JSON, NULL fields stripped) + computed `delta`
>   (`{col:{old,new}}`).** Both drop the mechanical noise `dirty` / `updated_at` /
>   `updated_by_user_id` (the who/when are first-class columns on the change row). The snapshot
>   makes a future "revert to this version" a straight write — not building revert now, just not
>   foreclosing it.
> - **Owner types indexed now: `entry`, `text`, `sentence` only.** Speakers/tags/dialects are NOT
>   indexed (no browsable timeline, and crucially **no rename fan-out** across entries — "speaker
>   name is an edge thing").
> - **Schema-drift survival = opaque JSON snapshots + a generic field-level diff renderer.** Additive
>   columns just appear as new keys; dropped/renamed columns stay frozen in old snapshots and render
>   generically. The audit tables' own schema is ~stable and needs no per-migration upkeep.
> - **`at` = server receive time** (stable, monotonic ordering; the client LWW clock can skew). We do
>   **not** store the client `updated_at` separately (bloat we won't use; it's inside the snapshot if
>   ever needed — actually it's stripped from the snapshot too, so it's simply not retained).
> - **Entry edits NEVER bubble to a text.** `entries`/`senses` rows resolve to `(entry, id)` only,
>   even though a future text view re-renders pronunciation/glosses from entries. A text is touched
>   only by the `texts` row itself or rows genuinely inside it.
> - **Read surfaces (both): per-prince timelines (entry/text/sentence) AND a dictionary-wide feed.**
> - **Read access = editors / managers / site-admins only** (NOT contributors, NOT anonymous) —
>   history can include private content. Exactly `verify_auth_dict_role(event, dict_id, 'editor')`
>   (editor rank 2 + manager rank 3 + admin bypass; contributor rank 1 → 403).
> - **Sentence overlap CONFIRMED:** a sentence that is BOTH part of a text (`text_id` set) AND linked
>   to a sense shows its edits in **both** the text and the entry timelines (it's a shared *sentence*
>   row, not an entry edit leaking into a text — `entries`/`senses` rows still never touch text).
> - **Build with red-green TDD against local SQLite** (see "Testing strategy"). mustang has **no local
>   dev dbs** — mock data is built programmatically into temp `DATA_DIR`s; poly is untouched.

## Status: COMPLETE (server + e2e + UI), all green. Pending: i18n strings; your visual review.

Done (red-green TDD, 29 history tests + existing 4 sync tests passing; tsc + eslint clean):
- `history-migrations/20260623_initial.sql`, `dictionary-history-db.ts` (open/cache/in-memory/
  `record_history`/delete-file), `dictionary-history-capture.ts` (`build_snapshot`/`build_delta`/
  `resolve_owners`), capture hooked into `process_dict_changes` + `merge_dict_row`, POST `/changes`
  wired to pass the history db, `dictionary-history-query.ts` + `GET /api/dictionary/[id]/history`
  (owner timeline + feed + `limit+1` keyset paging + user-name join + editor/manager/admin gate).
- Two real bugs caught by the red phase: (1) immutable `created_at`/`created_by`/`id` must be
  excluded from the delta comparison (a re-push carries a newer created_at that's never persisted →
  phantom diff); (2) ordering needs a monotonic tiebreaker (`rowid`) because two batches can share an
  `at` millisecond. Both fixed + regression-tested.

Remaining: `e2e/history-sync.mjs` (dev-server sync simulation + role-gate 200/403 assertions) and the
read UI (`<ChangeHistory>`/`<ChangeFeed>` + entry tab + `/[dictionaryId]/history`).

---

## Why the merge chokepoint is the whole game

Every *real* editor change funnels through one server function. The client writes to its wa-sqlite
copy (stamping `updated_at` + `updated_by_user_id` + `dirty=1`), the sync engine pushes dirty rows
to `POST /api/dictionary/[id]/changes`, and the server LWW-merges them into the authoritative
`dictionaries/{id}.db`:

```
browser edit → wa-sqlite (dirty=1) → sync push → POST /changes
   ↳ process_dict_changes(tx)                    ← site/src/lib/db/server/dictionary-sync-helpers.ts
       ↳ delete tombstone loop   ─ capture pre-delete image + owners ─┐
       ↳ merge_dict_row(existing,new) ─ capture after-image + delta + owners ─┤→ collect events
   ↳ COMMIT (main db)                                                 │
   ↳ append collected events → dictionaries/{id}.history.db  ◀────────┘  (after commit, best-effort)
```

- Viewers/anonymous pulls carry no dirty rows → never reach the merge → never create history. ✅
- The merge already stamps `updated_by_user_id = caller` — that authenticated caller **is** our
  `user_id` (server is the authority on "who"). ✅
- LWW early-return (server wins) records nothing — correct, nothing changed. ✅
- Bulk paths bypass `/changes` (cutover seed + direct server writes) → **no history for the big
  import**, which is exactly what we want. The in-app `/import` route is currently just a
  "contact us" placeholder, so there is no live bulk-edit path to special-case yet. If/when in-app
  bulk import is wired, decide then whether to tag or suppress it (legacy used an `import_id`).

---

## What already exists (don't rebuild)

| Piece | File | Notes |
|---|---|---|
| Merge chokepoint | `site/src/lib/db/server/dictionary-sync-helpers.ts` | `process_dict_changes` (push+pull tx) → `merge_dict_row` (LWW). **Hook capture here.** |
| Endpoint | `site/src/routes/api/dictionary/[id]/changes/+server.ts` | Resolves url→id, role, caller. Calls `process_dict_changes`. |
| Per-dict db open + migrations | `site/src/lib/db/server/dictionary-db.ts` (`get_dictionary_db`, `LATEST_DICT_MIGRATION`), `run-sql-migrations.ts` | Mirror this for the history db. |
| JSON column codec | `site/src/lib/db/schemas/dictionary-json-columns.ts` (`parse_dict_row`, `stringify_dict_row`, `DICT_JSON_COLUMNS`) | Use `parse_dict_row` to build snapshots with MultiString as nested JSON (not double-encoded). |
| Syncable table list / schema | `dictionary-sync-helpers.ts` (`DICT_SYNCABLE_TABLES`), `schemas/dictionary.ts`, `dictionary-migrations/20260606_initial.sql` | The 19 content tables + their FKs drive owner resolution. |
| Snapshot builder (NOT involved) | `site/src/lib/db/server/r2-snapshot-builder.ts` | History is a separate file → **nothing to strip**, snapshots stay lean. This is the payoff of the separate-file choice. |
| Users (for display names) | `shared.db` users table (`schemas/shared.ts`) | Read endpoint joins `user_id` → name/email. |
| Prior art | legacy Supabase `content_updates` (`scripts/types/supabase/generated.types.ts`) | `change` + `data` + per-type FKs + `type` + `user_id` + `timestamp` + `import_id`. We modernize: snapshot+delta, owners index instead of fixed FK columns. |

---

## Schema — `dictionaries/{id}.history.db`

New migration dir `site/src/lib/db/schemas/history-migrations/20260623_initial.sql`, applied on
open via the same `run_sql_migrations` mechanism (own `migrations` table inside the history db).

```sql
CREATE TABLE IF NOT EXISTS migrations ( id TEXT PRIMARY KEY, name TEXT NOT NULL, run_on TEXT NOT NULL );

CREATE TABLE IF NOT EXISTS changes (
  id         TEXT PRIMARY KEY,         -- uuid
  table_name TEXT NOT NULL,            -- which content table changed
  row_id     TEXT NOT NULL,            -- the changed row's id
  op         TEXT NOT NULL,            -- 'insert' | 'update' | 'delete'
  user_id    TEXT NOT NULL,            -- authenticated pusher (merge's updated_by)
  at         TEXT NOT NULL,            -- SERVER receive time, shared by one push batch
  snapshot   TEXT NOT NULL,            -- JSON after-image: parsed row, NULL cols stripped,
                                       --   minus dirty/updated_at/updated_by_user_id.
                                       --   For delete = final pre-delete image.
  delta      TEXT                      -- JSON {col:{old,new}} of changed content cols.
                                       --   insert: old omitted. delete: NULL.
);
CREATE INDEX IF NOT EXISTS idx_changes_row ON changes(table_name, row_id);
CREATE INDEX IF NOT EXISTS idx_changes_at  ON changes(at);          -- dict-wide feed

CREATE TABLE IF NOT EXISTS change_owners (
  change_id  TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL,            -- 'entry' | 'text' | 'sentence' (open-ended)
  owner_id   TEXT NOT NULL,
  PRIMARY KEY (change_id, owner_type, owner_id)
);
CREATE INDEX IF NOT EXISTS idx_change_owners_lookup ON change_owners(owner_type, owner_id);
```

The audit tables' schema is intentionally tiny + stable. All the volatile, schema-evolving shape
lives inside the opaque `snapshot`/`delta` JSON, so **content-table migrations require zero history
upkeep** as long as they stay additive.

---

## Owner resolution (`resolve_owners(db, table_name, row)` → `{type,id}[]`)

Run **inside the transaction** (data still present; for deletes, run before the cascade). Owners are
computed at edit time and **frozen** — re-parenting a row later leaves old edits under the old owner.
Only `entry` / `text` / `sentence` are emitted; bounded fan-out only (no shared-entity rename blast).

| table | owners emitted |
|---|---|
| `entries` | `(entry, id)` — **never text** |
| `senses` | `(entry, entry_id)` — **never text** |
| `texts` | `(text, id)` |
| `sentences` | `(sentence, id)`; if `text_id` → `(text, text_id)`; for each linked sense via `senses_in_sentences` → `(entry, sense.entry_id)` |
| `senses_in_sentences` | `(sentence, sentence_id)`; `(entry, sense.entry_id)` |
| `audio` | direct target: `entry_id`→`(entry,…)`, `sentence_id`→`(sentence,…)`, `text_id`→`(text,…)` (whichever set) |
| `audio_speakers` | the parent audio's owners (resolve via `audio` row) |
| `videos` | if `text_id` → `(text, text_id)` (else attached via junctions) |
| `video_speakers` | the parent video's owners (via `sense_videos`/`sentence_videos`) |
| `sense_videos` | `(entry, sense.entry_id)` |
| `sentence_videos` | `(sentence, sentence_id)` + that sentence's owners |
| `photos` | none direct (attached via junctions) |
| `sense_photos` | `(entry, sense.entry_id)` |
| `sentence_photos` | `(sentence, sentence_id)` + that sentence's owners |
| `speakers`, `dialects`, `entry_dialects`, `tags`, `entry_tags` | recorded in `changes`, but `entry_dialects`/`entry_tags` emit `(entry, entry_id)`; `speakers`/`tags`/`dialects` base-row edits emit **no owners** (no fan-out; not browsable as a timeline) |

> Sentence overlap (CONFIRMED): emit BOTH `(text,…)` and `(entry,…)` for a sentence that is both.
>
> Note: a base-table row change with **no owners** still lands in `changes` (so the dict-wide feed
> and per-row `(table_name,row_id)` lookups see it); it just won't appear in any prince timeline.

---

## Capture (in `dictionary-sync-helpers.ts`)

1. At the top of `process_dict_changes`, compute one `at = strftime('%Y-%m-%dT%H:%M:%fZ','now')` for
   the whole batch (rows pushed together share a coherent timestamp) and an empty `events[]`.
2. **Deletes loop:** before `INSERT OR REPLACE INTO deletes` (which fires the hard-delete cascade),
   `SELECT *` the target row from its table. If it existed, push `{op:'delete', table_name, row_id,
   snapshot: image, delta: null, owners: resolve_owners(...)}`.
3. **`merge_dict_row`:** change the existing-row probe from `SELECT updated_at` to `SELECT *`.
   - LWW server-wins → return early, record nothing.
   - `op = existing ? 'update' : 'insert'`.
   - `delta = diff(parse(existing), parse(new))` over content columns, excluding
     `dirty`/`updated_at`/`updated_by_user_id`. If `op==='update'` and `delta` is empty → **skip**
     (no real change; avoids noise from an updated_at-only re-push).
   - After the upsert, push `{op, table_name, row_id, snapshot: strip_nulls(parse(new) minus
     dirty/updated_at/updated_by_user_id), delta, owners: resolve_owners(...)}`.
4. After `COMMIT`, the endpoint (or a `record_history(history_db, events)` helper) opens
   `get_dictionary_history_db(id)` and writes all `events` + their owners in one history-db
   transaction. `process_dict_changes` either returns `events` alongside its response or takes an
   optional `on_committed(events)` callback — keep capture logic colocated, defer the write to
   post-commit so a history failure can never roll back or 500 the actual edit.

`snapshot`/`delta` build on `parse_dict_row` so MultiString/JSON columns are nested objects, not
double-encoded strings — the diff renderer then shows per-locale changes cleanly.

### Atomicity (accepted trade-off)
SQLite can't atomically commit across two files in WAL mode, so capture is a **best-effort append
after** the main-db commit. A server crash in the (sub-millisecond) window between commit and append
loses at most one history event — the actual data is always safe. Acceptable for an audit log; it's
the price of keeping history out of the main file + snapshots. (If we ever want perfect atomicity,
the fallback is a non-synced table inside `{id}.db` stripped at snapshot build — rejected here for
file-size/leanness.)

---

## Read API

`site/src/routes/api/dictionary/[id]/history/+server.ts` — `GET`:
- `?owner_type=entry|text|sentence&owner_id=…` → that prince's timeline:
  `SELECT c.* FROM changes c JOIN change_owners o ON o.change_id=c.id
     WHERE o.owner_type=? AND o.owner_id=? ORDER BY c.at DESC, c.id DESC LIMIT ? [keyset cursor]`.
- `?feed=1` → dictionary-wide recent activity: `SELECT * FROM changes ORDER BY at DESC LIMIT …`.
- Keyset pagination on `(at, id)` via a `?before=` cursor.
- Resolve `user_id`→display name once: join `shared.db` users, return a `{ users: {id:{name,email}} }`
  map alongside `changes` so the payload isn't repetitive. Handle unknown/removed users gracefully.
- **Auth: `verify_auth_dict_role(event, dict_id, 'editor')`** → editors + managers + site-admins
  only. Contributors and anonymous get **403** (history can include private content). This is a hard
  gate, asserted in the e2e tests.
- Opens the history db **read-only**; if the file doesn't exist yet (no edits since this shipped),
  return an empty timeline.

---

## Read UI

- Reusable `<ChangeHistory owner_type owner_id />` (and a `<ChangeFeed />`) Svelte component fed by
  the API. **Generic, schema-agnostic renderer:** a timeline grouped by day; each item shows the
  editor (name/avatar), an op badge (added/edited/removed), a human table label, and a field-level
  diff from `delta` (MultiString rendered per-locale, old→new). Unknown/removed fields render
  generically so the view never breaks on schema drift. Deletes render the final snapshot as
  "removed".
- **Entry:** a history tab/panel on `site/src/routes/[dictionaryId]/entry/[entryId]/` (owner_type
  `entry`). This is the primary ask.
- **Text / Sentence:** reuse the same component on their detail views when those UIs land (owner_type
  `text` / `sentence`). The data is captured now regardless of UI readiness — long-term solution.
- **Dictionary-wide feed:** the reserved `/[dictionaryId]/history` route (it's in the AGENTS.md route
  list but no file exists yet) → `<ChangeFeed />`.

---

## Testing strategy (red-green TDD against local SQLite)

Build test-first: for each checklist item, write the failing test, watch it go red, implement, watch
it go green. Three layers, fast → realistic. **Verified working on mustang** (see setup below).

### Layer 0 — local feedback-loop setup (one-time, mustang had nothing)
- mustang has **no `site/.data` and no installed deps** out of the box (tuf has some dbs; we don't
  depend on them, and **poly is never touched**). Bring-up:
  1. `pnpm install` (root) — compiles native `better-sqlite3`.
  2. **`pnpm exec svelte-kit sync`** (in `site/`) — generates `.svelte-kit/tsconfig.json`. **Without
     this every vitest file fails `[TSCONFIG_ERROR] Tsconfig not found`** (site/tsconfig.json extends
     the generated one). This is the gotcha that blocks a cold test run.
- Run unit/integration: `pnpm exec vitest run <path>` (from `site/`), or `pnpm test` (root → filters
  to `site`). Fast: in-memory better-sqlite3, ~700ms.
- All tests isolate state via a temp `DATA_DIR` (`get_dictionaries_dir()` reads `process.env.DATA_DIR
  || '.data'`), created with `mkdtempSync` and cleaned up in `afterAll` so nothing pollutes the repo.

### Layer 1 — unit (vitest): pure functions
- `resolve_owners(db, table_name, row)` over the **full table matrix** above. One assertion per row:
  - `entries`/`senses` → exactly `(entry, …)`, and **assert NO `(text, …)`** (the entry≠text boundary).
  - `texts` → `(text, id)`.
  - `sentences`: standalone (no text_id, no sense link) → `(sentence,id)` only; text-only → `+ (text)`;
    sense-linked → `+ (entry)`; **both → (sentence)+(text)+(entry)** (the confirmed overlap).
  - junctions (`entry_tags`/`entry_dialects` → entry; `sense_photos`/`sense_videos` → entry;
    `sentence_photos`/`sentence_videos` → sentence; `audio_speakers`/`video_speakers` → parent media's
    owners), media owner-by-FK, and the **no-owner** base rows (`speakers`/`tags`/`dialects`).
- `snapshot`/`delta` builders: NULL columns stripped; `dirty`/`updated_at`/`updated_by_user_id`
  dropped from BOTH; MultiString/JSON columns are nested objects (via `parse_dict_row`), not
  double-encoded; delta is `{col:{old,new}}` with `old` omitted on insert.

### Layer 2 — integration (vitest): the merge chokepoint end-to-end, in memory
Extend `dictionary-sync.test.ts` (or a new `dictionary-history.test.ts`). Open an in-memory dict db
(`open_dictionary_db_in_memory`) + a new in-memory history db helper
(`open_dictionary_history_db_in_memory`), call `process_dict_changes` with crafted requests, then
read **both** dbs and assert. Cases (each its own red-green):
- push new entry → `changes` has one `op='insert'` row + `change_owners (entry, entry_id)`; snapshot
  round-trips lexeme; delta has `lexeme.new`, no `old`.
- update entry field → `op='update'`, delta `{phonetic:{old,new}}` only (no `updated_at` noise).
- **LWW server-wins** (push a row with older `updated_at` than server) → merge skips → **no history row**.
- **empty-delta update** (re-push identical content, newer `updated_at`) → **no history row**.
- delete (tombstone) → `op='delete'`, snapshot = pre-delete image, `delta` null, owners resolved from
  the pre-image (assert it captured before the cascade wiped children).
- **multi-row batch** in one push → all share one `at`; FK-order independent; owners correct per row.
- sentence linked to a text + a sense → change_owners has all three types.
- viewer push (`is_editor=false`) → row rejected AND **no history row**.
- a `(speakers)` rename → `changes` row exists but **zero `change_owners`** (no fan-out).

### Layer 3 — e2e sync simulation (`e2e/history-sync.mjs`, new `test:history` script)
Match the existing `e2e/dict-sync.mjs` style (boot the dev server with `start-server-and-test` or a
spawned `vite dev` on a temp `DATA_DIR`; the harness pipes server stderr). **Simulate syncs of all
sorts** over real HTTP, then read the on-disk `.db` + `.history.db` with better-sqlite3:
1. **Seed mock data programmatically** (no fixtures exist): a `shared.db` with one dictionary catalog
   row + three users wired into `dictionary_roles` — a **manager**, an **editor**, a **contributor** —
   plus an anonymous caller. (Model on `scripts/seed-achi-fixture.ts` + `schemas/shared.ts`; auth in
   the e2e is via the same cookie/JWT path the other e2es use.)
2. **Drive a sequence of `POST /api/dictionary/[id]/changes`** exercising every sync shape:
   - cold first sync from an anonymous viewer (pull-only) → no history;
   - editor pushes a new entry + sense;
   - editor edits the entry (phonetic) and a sense (gloss) → assert entry timeline grows, **text
     timeline untouched**;
   - editor adds a sentence with `text_id` + links it to the sense → appears under text AND entry;
   - editor adds audio + an `audio_speakers` link;
   - a **second editor** pushes a conflicting edit (exercise LWW) ;
   - editor deletes the sense → delete event with who/when;
   - a multi-table batch push;
   - a viewer/anonymous pull mid-stream → creates no history.
   After key steps, open both dbs and assert `changes`/`change_owners` match expectations.
3. **Read endpoint + role gate:** `GET /api/dictionary/[id]/history?owner_type=entry&owner_id=…` and
   `?feed=1` →
   - manager & editor & admin → **200** with the expected timeline + resolved user names;
   - contributor & anonymous → **403**;
   - keyset pagination returns stable, non-overlapping pages.
4. Tear down the temp `DATA_DIR`.

### What "thorough" means here (assert, don't assume)
Every test reads the **actual SQLite rows** (dict db AND history db) rather than trusting return
values — the whole point is "read the various dbs and make sure things look right." Cover the happy
path, the three no-op paths (LWW, empty-delta, viewer), the delete pre-image, the multi-owner overlap,
the no-owner base rows, and the auth gate.

## Backups / ops
- `dictionaries/{id}.history.db` sits in the same `/data/dictionaries/` dir as `{id}.db`, so it's
  covered by whatever backs up that volume. No new backup wiring, but note it exists.
- History grows unbounded by design. Entries are small text; revisit retention only if a dict's
  history file gets large. No pruning in v1.

---

## Build checklist (red-green, in dependency order)
- ✅ **Setup:** `pnpm install` + `pnpm exec svelte-kit sync` so vitest runs (done on mustang).
- ✅ `history-migrations/20260623_initial.sql` (changes + change_owners + indexes).
- ✅ `dictionary-history-db.ts`: `get_dictionary_history_db(id)`, `open_dictionary_history_db_in_memory()`,
      `record_history(db, events)`, `history_db_path`, delete-file helper.
- ✅ **(test-first)** `snapshot`/`delta` builders — Layer-1 unit tests.
- ✅ **(test-first)** `resolve_owners(db, table_name, row)` — Layer-1 unit tests over the full table
      matrix (entry≠text boundary, sentence triple-overlap, no-owner base rows).
- ✅ **(test-first)** Hook `process_dict_changes`: batch `at`, delete-loop pre-image capture,
      `merge_dict_row` `SELECT *` + delta + skip-empty-update + skip-LWW-loss, collect events,
      post-commit `record_history` — Layer-2 integration tests (in-memory dict + history dbs).
- ✅ Wire the endpoint (`changes/+server.ts`) to append events after the commit.
- ✅ `GET /api/dictionary/[id]/history` (owner timeline + feed + keyset paging + user-name join +
      editor/manager/admin gate) + `query_history` Layer-2b tests.
- ✅ **(test)** `e2e/history-sync.mjs` (`test:history`) — Layer-3 dev-server sync simulation + role gate.
      **32 assertions pass.** HTTP-only (cookie jar, no browser): isolated temp `DATA_DIR`, seeds
      shared.db (dict + manager/editor/contributor), drives cold-pull → inserts → text+sentence+sense
      link → media+speaker → LWW-losing 2nd-editor push → delete → mid-stream pull, reads both `.db`
      files, asserts attribution boundaries + the `GET /history` gate (manager/editor 200, contributor
      403, anon 401).
- ✅ Generic renderer + read UI:
  - `$lib/components/history/ChangeTimeline.svelte` (presentational, prop-driven, schema-agnostic:
    day grouping, op badges, table/field label maps with humanize fallback, MultiString/array value
    formatting, old→new diffs, load-more) + `format.ts` helpers + `types.ts`.
  - `$lib/components/history/ChangeHistory.svelte` (fetches `/api/dictionary/[id]/history`, paginates).
  - `/[dictionaryId]/history` route (dict-wide feed; `+page.ts` gates to `is_editor_or_above`).
  - Entry detail: a **History** button (gated on `is_editor_or_above`) opens a Modal with the entry's
    timeline. Added `is_editor_or_above` to `[dictionaryId]/+layout.ts` (editor-rank+, excludes bare
    contributors — mirrors the server gate).
  - `ChangeTimeline.stories.ts` mocks; screenshot verified via svelte-look
    (`e2e/screenshots/history-entry-timeline.png`).
  - NOTE: UI strings are hardcoded English for now (labels + "History"); i18n-key extraction to
    `en.json` is a deliberate follow-up (sentence/text detail UIs aren't built yet either).

### Build/run gotcha (mustang, for the e2e)
`node build` (and thus `test:history`) needs the `$env/static/*` vars present at **build** time;
mustang has no `.env` and the sandbox blocks creating one, so build by passing them as process env:
`PUBLIC_mapboxAccessToken=… PUBLIC_MODE=development PUBLIC_STORAGE_BUCKET=… PUBLIC_GOOGLE_OAUTH_CLIENT_ID=…
AWS_SES_ACCESS_KEY_ID=… AWS_SES_REGION=us-east-1 AWS_SES_SECRET_ACCESS_KEY=… DKIM_PRIVATE_KEY=…
MAILCHANNELS_API_KEY=… pnpm -F site build` (dummy values are fine — the e2e uses `E2E_EXPOSE_OTP` so
no email is actually sent). Runtime env (JWT_SECRET/DATA_DIR/E2E_EXPOSE_OTP) is set by the script.

## Knowledge to write on completion
- `.knowledge/domain/change-history.md`: the merge-chokepoint capture decision, the owners-index
  vs fixed-FK-columns rationale, the entry≠text attribution boundary + the one sentence overlap, the
  best-effort-append atomicity trade-off, and the schema-drift-survival contract (additive-only).
