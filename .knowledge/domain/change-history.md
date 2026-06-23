# Change history (server-side audit log)

Editors can browse a record's edit history — who changed what, and when — for **entries, texts, and
sentences** (the three browsable "princes"; entry is not special). Server-only, pulled on demand,
**never synced to clients and never in R2 snapshots**. The full spec/plan is `.issues/change-history.md`;
this page records only the *why*s that aren't obvious from the code.

## Where it hooks in (the one decision that makes the rest simple)
Every *real* editor change funnels through one server function — `process_dict_changes` /
`merge_dict_row` in `dictionary-sync-helpers.ts` (the `/api/dictionary/[id]/changes` push handler).
Capturing there means: zero client/sync changes, every edit caught once, and the server's authenticated
identity is the recorded "who". Viewer pulls carry no dirty rows → never reach the merge → never create
history. Bulk paths (cutover seed, future direct writes) bypass `/changes` → intentionally unrecorded.

## Shape & storage
- A **separate file** `dictionaries/{id}.history.db` (NOT a table in the main dict db). Keeps the main
  db + viewer snapshots lean forever and lets history grow unbounded. Cost: capture is a **best-effort
  append AFTER the main-db commit** (SQLite can't atomically commit across two files in WAL mode) — a
  crash in the sub-ms window loses at most one audit event; the data is always safe.
- Two tables: `changes` (id, table_name, row_id, op, user_id, at, snapshot, delta) + `change_owners`
  (change_id, owner_type, owner_id). The **owners side-table is a many-to-many index** (not denormalized
  FK columns) so one change can belong to several subjects and a NEW owner type later is just a new
  string — never a migration. The old Supabase `content_updates` used fixed FK columns; that's lossy on
  multi-owner changes and is why it "never really worked."

## Why it survives schema changes (the hard part)
`snapshot` (full after-image) and `delta` (`{col:{old,new}}`) are **opaque JSON**. Additive content-table
columns just appear as new keys; a dropped/renamed column stays frozen in old snapshots. The reader
(`ChangeTimeline.svelte` + `format.ts`) is **schema-agnostic**: table/field labels are lookup-with-
humanize-fallback, so an unknown/new column renders as its humanized name with no code change. The audit
tables' own schema is tiny and stable → content migrations need **zero** history upkeep (as long as
they stay additive).

## Attribution rules (the entry≠text boundary)
`resolve_owners` (in `dictionary-history-capture.ts`) is the single source of truth. Key invariants:
- **`entries`/`senses` rows resolve to `(entry, …)` ONLY — never a text.** A text view re-rendering an
  entry's pronunciation is still an *entry* edit. A text is touched only by the `texts` row itself or
  rows genuinely inside it.
- The one legitimate overlap is a **sentence** that is both in a text (`text_id`) and linked to a sense
  (`senses_in_sentences`): it resolves to `(sentence)+(text)+(entry…)` — it's a shared *sentence* row,
  not entry-edit leakage.
- Only `entry`/`text`/`sentence` are indexed. **Speakers/tags/dialects base-row edits emit NO owners**
  (recorded in `changes`, visible in the dict-wide feed, but a rename never fans out across entries).
  Their *junctions* (`entry_tags`/`entry_dialects`) DO attribute to the one entry (bounded).

## Subtle correctness bugs (caught by the red phase — keep these true)
- **Delta must exclude immutable columns** (`id`, `created_at`, `created_by_user_id`) plus the noise
  (`dirty`, `updated_at`, `updated_by_user_id`). The merge never persists created_*/id on conflict, so a
  re-push carrying a newer `created_at` would otherwise flag a phantom change.
- **Ordering uses `rowid`, not `at`.** `at` is one server-receive stamp shared by a whole push batch, so
  two batches can collide on the same millisecond; `rowid` is the monotonic tiebreaker (read API orders
  `at DESC, rowid DESC`; keyset cursor = rowid; `query_history` fetches `limit+1` to know when to stop).
- Update with an empty delta (content unchanged) and an LWW-losing push both record **nothing**.

## Read gate
`GET /api/dictionary/[id]/history` and the `/[dictionaryId]/history` page use
`verify_auth_dict_role(…, 'editor')` / the layout's `is_editor_or_above` = **editors + managers +
site-admins only** (NOT contributors, NOT anon). History can include private content. `can_edit`
includes contributors, so it's the wrong flag for this — hence the separate `is_editor_or_above`.

## Tests
`dictionary-history.test.ts` (vitest: snapshot/delta/resolve_owners matrix + capture through the real
`process_dict_changes` + `query_history`); `e2e/history-sync.mjs` (`pnpm -F site test:history`) drives
the real dev server over HTTP (cookie jar, no browser) through every sync shape + the role gate.
**To build for the e2e on a machine without `.env`**, pass the `$env/static/*` vars as process env to
`pnpm build` (dummy values fine; the e2e uses `E2E_EXPOSE_OTP` so no email sends) — see the issue file.
