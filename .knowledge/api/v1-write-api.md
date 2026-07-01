# `/api/v1` agent-friendly write API + API keys

The public, bulk-capable write API that lets a third party's agent (via an API key
minted in dictionary Settings) do anything a human editor can. Built so LD is
"agent-friendly"; first proven by importing a parsed PDF dictionary through it.

Code is the source of truth — this captures the **decisions + non-obvious wiring**
that reading one file won't reveal.

## The core design decision: reuse the human write path

An API write does NOT get a bespoke write path. It builds the dict.db rows and
applies them through the **same `merge_dict_row`** (`db/server/dictionary-sync-helpers.ts`)
that a browser editor's `/changes` push uses. Consequence: API edits are
*indistinguishable* from human edits — same audit stamping, same per-table
`last_modified_at` triggers (so open editors pull them on their next `/changes`
sync), same change-history capture, same `shared.db.dictionaries.updated_at`
mirror, same R2-snapshot pickup on the normal cron. **No special propagation /
scheduling exists or is needed** (a thing we explicitly decided NOT to add).

`merge_dict_row` was made `export` for this reuse. It does `INSERT … ON CONFLICT(id)
DO UPDATE`, which means **it needs a FULL row** (all NOT NULL columns) — a partial
patch fails the NOT NULL check before the upsert resolves. So `apply_entry_update`
(PATCH) reads the existing parsed row, overlays the patch, and passes the full row.
It also `delete row.updated_by_user_id` before handing off, because `merge_dict_row`
only stamps the editor when that column is ABSENT — otherwise the spread carries the
stale editor.

## Why no dict.db migration was needed

Every column an entry/sense/sentence/example/dialect/tag/speaker import touches
already exists. The only schema change is `shared.db`'s new **`api_keys`** table.
This kept the write API schema-stable (no snapshot-version churn).

## API keys

- `api_keys` is **server-only** (NOT in `SYNCABLE_TABLE_NAMES`, no `dirty` column) —
  same class as `email_codes`. Hashes must never reach an admin browser.
- Only the **sha-256 hash** is stored; the raw `ldk_<base64url(32B)>` token is shown
  ONCE on create. `verify_api_key` looks up by hash, rejects revoked, throttles the
  `last_used_at` write to ~once/minute.
- A key is scoped to ONE dictionary and carries a **`read` or `write`** access level
  (default `write`) — deliberately NOT the dict-role vocabulary (contributor/editor/
  manager), since the v1 API can't change settings so "manager" would be meaningless.
  API writes are attributed to the key's **creator** (`created_by_user_id`) so history/
  audit name a real human; if that user was deleted, a `apikey:<id>` sentinel keeps
  dict.db's NOT NULL audit columns satisfied.
- `verify_dict_api_access(event, dict_id, min_role)` is the gate for `/api/v1/*`: an
  `Authorization: Bearer ldk_…` key (hash lookup + dict-scope match + `API_KEY_RANK`
  where `read`→contributor-rank, `write`→editor-rank vs `min_role`) OR a normal
  session/JWT via `verify_auth_dict_role`. Detects an LD key by the `ldk_` prefix; a
  JWT bearer falls through to the session path (which keeps the contributor/editor/
  manager vocab, since `dictionary_roles` is unchanged).

## Bulk semantics

`POST …/entries` accepts a single entry, a bare array, or `{ entries, import_id }`
(≤1000). One outer transaction; **each entry is a SAVEPOINT** → per-item best-effort
(`{ created, updated, failed, results }`). Dialects/tags are found-or-created and
deduped by case-insensitive name; a new dialect/tag created inside a failed item is
rolled back with it (merged into the shared name→id map only on the item's success).
`import_id` → a private batch tag attached to every entry (mirrors the legacy CSV
importer's batch-tag idempotency trick). Idempotency is otherwise agent-managed:
the response returns `external_id → entry_id`, and the list endpoint filters by
`elicitation_id` for dedupe.

## Surgical edit/delete + unlink endpoints

Beyond the entry-level `PATCH`/`DELETE`, there are dedicated single-row routes so an
agent can fix ONE OCR typo without re-importing (Jacob approved the **full set**
2026-06-30): `PATCH`/`DELETE …/sentences/{id}`, `DELETE …/senses/{id}`,
`PATCH`/`DELETE …/tags/{id}` & `…/dialects/{id}`, and
`DELETE …/entries/{entryId}/tags/{id}` (+ `/dialects/{id}`) for entry-scoped unlink.
Flat-by-id URLs were chosen over deep nesting — the ids come straight off the entry
READ shape (`senses[].id`, `senses[].sentences[].id`, `tags[].id`, `dialects[].id`).

Design decisions (mirror the human path, like the rest of v1):
- **`delete_dict_row`** (`dictionary-sync-helpers.ts`) is the new write-side sibling of
  `merge_dict_row`: capture before-image + owners, insert the `deletes` tombstone (fires
  `process_delete_cascade`), return a `delete` HistoryEvent. `apply_entry_delete` was
  refactored onto it; `run_tombstone_delete` (`v1-entry-write.ts`) wraps it in the v1
  txn + history + cursor and is shared by every delete/unlink helper.
- **Global delete vs. entry-scoped unlink are different rows.** Deleting a tag/dialect
  tombstones the `tags`/`dialects` row → FK cascade sweeps every `entry_tags`/`entry_dialects`
  junction (unlinks everywhere). Unlinking from ONE entry tombstones just that JUNCTION row
  (the tag/dialect survives). Tag rename + dialect rename guard against name collisions
  (reuse `name_key` + `list_tags`/`list_dialects`).
- **Sense delete refuses an entry's LAST sense** (throws → 400 "delete the entry instead")
  so an entry always keeps ≥1 sense, matching the UI's new-entry shape.
- Sentence PATCH echoes back the updated sentence (`{ sentence }`); tag/dialect PATCH echo
  `{ tag }`/`{ dialect }` — friendlier than a second GET for the agent to verify its edit.

## `entry_count` is intentionally NOT maintained on write

After a bulk import `GET /dictionaries/{id}.entry_count` lags (it's eventually-consistent).
We **decided NOT to update it eagerly** (Jacob, 2026-06-30): editors get live counts from
the dictionary's **search-tool totals**, so an eager counter would be redundant work on the
hot write path. Docs tell agents to paginate `/entries` for a live count instead. Don't
re-propose maintaining `entry_count`.

## Gotchas worth keeping

- **`+server.ts` may only export HTTP-method handlers** (+ `_`-prefixed). A non-handler
  *value* export (we hit it with batch-size constants) throws "Invalid export …" at
  request time — invisible to unit tests (they import handlers directly) and to
  `lint`/`check`. Always live-smoke a new endpoint over HTTP. Put shared constants in a
  lib module, not the route file. (Type/interface exports are fine — erased.)
- **Entry/sense delete leaves standalone sentences.** The `deletes` tombstone → cascade
  removes the entry/sense and the `senses_in_sentences` junction (FK ON DELETE CASCADE),
  but `sentences` rows have no FK to a sense, so they survive (they can belong to a text /
  other senses). This matches the existing human-delete behavior — don't "fix" it without
  deciding orphan policy globally. (To delete the sentence itself, use `DELETE …/sentences/{id}`,
  which tombstones the `sentences` row and cascades ITS junctions.)
- Reads (`GET …`) are key/session gated at `contributor`; writes at `editor` (the
  endpoint `min_role` stays in the dict-role vocab for the session path; an API key's
  `read`/`write` maps onto those ranks). Read endpoints pass `admin_level: 1` to
  `build_entry_data` so a dict-scoped caller sees their own private content (incl. the
  private import tag).

## Where things live

- Keys: `$lib/api-keys/api-key.ts` + `shared-migrations/20260629_api_keys.sql` +
  `routes/api/dictionaries/[id]/api-keys/*` (manager-gated CRUD) + the Agents-page
  panel `$lib/components/settings/ApiKeys.svelte` (+ `AgentPrompt.svelte`, a
  copyable "hand this to your agent" prompt).
- Auth gate: `$lib/auth/verify-dict-api-access.ts`.
- Write engine: `$lib/db/server/v1-entry-write.ts` (`apply_entry_writes` /
  `apply_entry_update` / `apply_entry_delete` / `apply_sentence_update` /
  `apply_sentence_delete` / `apply_sense_delete` / `run_tombstone_delete`) +
  `v1-sub-resources.ts` (`apply_tag_update`/`apply_tag_delete`/`apply_dialect_update`/
  `apply_dialect_delete`/`unlink_entry_tag`/`unlink_entry_dialect`). Tombstone primitive:
  `delete_dict_row` in `dictionary-sync-helpers.ts`.
- Input shapes/helpers: `$lib/api/v1/entry-input.ts`. Spec: `$lib/api/v1/openapi.ts`.
- Routes: `routes/api/v1/**` (entries CRUD + `…/sentences/{id}`, `…/senses/{id}`,
  `…/tags/{id}`, `…/dialects/{id}`, `…/entries/{entryId}/tags|dialects/{id}`,
  speakers/tags/dialects collections, dict meta, `openapi.json`, landing).
