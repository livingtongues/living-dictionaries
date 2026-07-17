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
- `verify_dict_api_access(event, dict_id, access)` is the gate for `/api/v1/*`, where
  `access` is the API's OWN vocabulary **`'read' | 'write'`** — NOT a dict role. An
  `Authorization: Bearer ldk_…` key is checked by its scope DIRECTLY (`read` endpoints
  accept read|write keys; `write` requires a write key — `key_scope_allows`), with zero
  contributor/editor language. A JWT bearer falls through to the session path, the ONE
  place `access` maps onto a human role (`ACCESS_TO_HUMAN_ROLE`: read⇒contributor+,
  write⇒editor+) via `verify_auth_dict_role`.
- **Why the read/write ↔ contributor/editor decoupling** (Jacob flagged the old conflation
  2026-07-01): the earlier code fused key scopes onto the dict-role RANK NUMBERS
  (`API_KEY_RANK` read→1/write→2) so one `min_role` arg could gate both paths. That read
  like an equivalence ("a read key IS a contributor") that doesn't exist and dragged a human
  concept into a key-only decision. Now the two systems are independent axes that meet only
  at the endpoint's declared `access`. Keys still can't reach manager actions (minting/
  revoking keys is session-manager-only), so nothing was lost.

## Bulk semantics

`POST …/entries` accepts a single entry, a bare array, or `{ entries, import_id }`
(≤1000). One outer transaction; **each entry is a SAVEPOINT** → per-item best-effort
(`{ created, skipped, updated, failed, results }`). Dialects/tags are found-or-created and
deduped by case-insensitive name; a new dialect/tag created inside a failed item is
rolled back with it (merged into the shared name→id map only on the item's success).
`import_id` → a private batch tag attached to every entry (mirrors the legacy CSV
importer's batch-tag idempotency trick).

## Idempotency = client-supplied `id` (NOT a stored external_id)

Decided 2026-07-01 (Jacob): the agent generates a **UUID v4** and sends it as the entry's
`id`. That reuses the existing PRIMARY KEY (zero extra storage — no `external_id` column
bloating dict.db + every R2 snapshot + every browser copy), the agent inherently owns the
map (it picked the id), and it can `PATCH …/entries/{id}` immediately without a discovery
round-trip. **`external_id` was dropped** (an unknown `external_id` field is silently ignored).
Guardrails baked in:
- **Skip, don't clobber.** `resolve_client_id` validates the UUID (bad → item `failed`); if the
  id already exists the whole item is SKIPPED (`status: 'exists'`), because `merge_dict_row` is
  an LWW upsert that would otherwise overwrite a different logical entry. Editing is PATCH's job.
- `id` is optional (omit → server mints one). Senses/sentences/texts accept a client `id` too.
- **Any UUID version is accepted** (`is_uuid` doesn't check the version nibble) — deterministic
  uuid5-of-external-key ids are an explicitly supported import pattern. Docs no longer say "(v4)".
- **PATCH senses are a TRUE upsert by client id** (2026-07-02, from agent feedback): an unknown
  sense id → create the sense WITH that id (so deterministic ids keep addressing the same sense
  across re-syncs); an id on a DIFFERENT entry → 400 (the only remaining guard — prevents
  cross-entry sense theft). Before this, an unknown id 400'd ("not found on this entry") while the
  docs already promised upsert. Same fix made deterministic-id re-PATCHes idempotent: an
  already-linked `senses_in_sentences` pair is skipped, and a re-sent sentence row is overlaid
  onto the existing parsed row before `merge_dict_row` (the partial insert image otherwise trips
  `NOT NULL created_by_user_id` — SQLite checks NOT NULL before ON CONFLICT diverts to UPDATE).

## Texts (connected passages) — added 2026-07-01

Full CRUD at `…/texts` + `…/texts/{textId}` (`v1-texts.ts`). A **text** is `texts.title` +
ORDERED child `sentences` (each `text_id`-linked, `sort_key` fractional index, optional
`ends_paragraph`). Unlike an entry's example sentence, a text-sentence is standalone (**no
`senses_in_sentences` junction**). Ordering uses `$lib/api/v1/fractional-index.ts`
`key_between` (canonical dgreensp midpoint over base-36 fractions — outputs never carry a
trailing zero, the invariant that keeps the recursion terminating; an earlier hand-rolled
midpoint infinite-looped). Create assigns `initial_keys(n)`; PATCH appends after the max key
and reorders by reassigning `initial_keys` to a given id order. **Text DELETE also tombstones
its sentences** (the FK is SET NULL, which would otherwise orphan them). Single text-sentence
edits reuse `PATCH …/sentences/{id}` (now also handles `ends_paragraph`).

## Agent feedback → a support message (not a log)

`POST …/feedback` (access `read`, so read keys too) lets an agent tell the LD team what it
needs. Decided 2026-07-01 (Jacob): it must be SEEN FAST, so it lands as an UNRESOLVED
`message_threads` row (`source: 'agent_feedback'`) assigned to `FEEDBACK_OWNER_EMAIL`
(jwrunner7@gmail.com), NOT in `client_logs` (which the log-and-fix run would bury). The key
creator is snapshotted as the sender so a reply reaches the human. The response includes a
`relay_to_human` sentence the agent should surface. Anti-flood (`agent-feedback.ts`): in-memory
per-key limit 3/hr + 10/day (429, non-blocking), and past 10 OPEN feedback threads a key's new
feedback folds into its newest thread instead of spawning more. `url` on the thread stores
`agent-feedback:<key_id>` to group a key's threads.

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

- **`import_id` creates its batch tag even for an EMPTY batch.** `apply_entry_writes`
  (`v1-entry-write.ts`) calls `ensure_import_tag` INSIDE the outer `BEGIN IMMEDIATE`, BEFORE the
  per-entry loop, guarded only by `import_id` being truthy — not by `entries.length`. So a
  `POST …/entries { entries: [], import_id: 'run-42' }` still find-or-creates the private `run-42`
  tag (a real `tags` row + a change-history event) with nothing pointing at it. This is
  deliberate-enough (the tag find-or-create is idempotent, so a later non-empty batch with the same
  `import_id` just reuses it), but agents doing a dry-run / probe POST should know an empty batch is
  NOT side-effect-free. Don't "fix" by moving the call into the loop without deciding whether a
  zero-entry import should register its batch label.
- **`sentence_order` is an ALL-OR-NOTHING reorder — a partial list interleaves unpredictably.**
  `apply_text_update`'s reorder branch (`v1-texts.ts`) validates every id belongs to the text (a
  foreign id → throws, whole PATCH rolls back), then assigns `initial_keys(sentence_order.length)`
  — a FRESH evenly-spaced key sequence generated from the base of the keyspace — to ONLY the listed
  sentences. Sentences omitted from `sentence_order` keep their OLD `sort_key`, so they can land
  before/after/among the reordered set depending on how their stale keys compare to the freshly
  minted ones (it does NOT preserve their relative position or splice them in). To reorder reliably,
  pass the COMPLETE ordered list of every sentence id in the text. (`append_sentences` in the same
  PATCH is applied first and does key-after-max correctly; only the partial-`sentence_order` case is
  the trap.)
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
- Reads (`GET …`) require `access: 'read'`; writes `access: 'write'` (see the decoupling
  note under API keys). Read endpoints pass `admin_level: 1` to `build_entry_data` so a
  dict-scoped caller sees their own private content (incl. the private import tag) — note
  this means EVERY key (even read-only) sees private content; there is no "public-only" read
  key yet (considered + deferred 2026-07-01).
- **JSON double-encoding when re-merging RAW rows.** `stringify_dict_row` (inside
  `merge_dict_row`) calls `JSON.stringify` UNCONDITIONALLY on JSON columns — so feeding it a
  row read straight from `SELECT *` (where `lexeme`/`notes`/`title`/… are already JSON strings)
  double-encodes them. ALWAYS `parse_dict_row(...)` a raw row before spreading it back into a
  merge. This was a live bug in `remove_source_from_all` (source delete corrupted every
  referencing entry's lexeme/notes) — fixed 2026-07-01, regression-tested in
  `sources/server.test.ts`. The `read_parsed_row` helper already does this for the entry/sense/
  sentence PATCH paths.
- The `entries` list `?include=senses` attaches each entry's senses (glosses/definition/POS/
  domains) via ONE batched `WHERE entry_id IN (…)` query — the efficient bulk-read/export path
  (default off keeps the list cheap). Reader keys otherwise had to N+1 `GET …/entries/{id}`.
- **Request body limit.** adapter-node defaults `BODY_SIZE_LIMIT=512K`, far under a ≤1000-entry
  bulk POST. Set to `16M` (docker-compose `environment:` locally; the prod value must be added to
  `sveltekit-living.env` in vps-setup). Docs advertise a ~16MB ceiling.

## Media uploads: CSRF carve-out + content validation (2026-07-01)

Two things an agent bulk-using the media endpoints hit, both non-obvious from one file:

- **The multipart-upload 403 was SvelteKit's CSRF guard, not ours.** SvelteKit forbids any
  form-content-type POST (`multipart/form-data`, `x-www-form-urlencoded`, `text/plain`,
  `x-sveltekit-formdata`) whose `Origin` header ≠ the site origin — **including requests with
  NO `Origin` header, which is exactly what a server-side API client sends**. It runs inside
  `internal_respond` **BEFORE** the `handle` hook (so you can't exempt a route while it's on) and
  is **`!DEV`-gated** (only bites in production — invisible in local dev). JSON `{url}` uploads
  were unaffected (not a form content type). Fix: disable it globally in `svelte.config.js`
  (`csrf: { trustedOrigins: ['*'] }` — `checkOrigin` is deprecated in kit 2.63; and
  `trustedOrigins` can't whitelist the no-Origin case anyway) and **re-implement it in
  `hooks.server.ts`** via `is_cross_origin_form_forbidden` (`$lib/server/csrf.ts`), which
  faithfully mirrors SvelteKit's check with ONE carve-out: exempt `/api/v1/*` requests carrying an
  `Authorization` header. Safe because browsers never auto-attach `Authorization` and cross-origin
  JS can't set it on a simple form POST without a CORS preflight → a Bearer request is provably not
  a forged cookie-riding submission. Every cookie-authed form POST keeps full protection.

- **Media bytes are content-validated server-side before storage** (`validate-media-bytes.ts`),
  on BOTH the multipart `file` and the fetched `{url}` paths, so a URL that returns an HTML "not
  found" page at HTTP 200 can't be saved AS audio. Hybrid: magic-byte sniff positively rejects
  HTML/XML/SVG/JSON/PDF/plain-text and cross-category media (image→audio), AND the declared
  content-type's category must not conflict — but `application/octet-stream` / unlabeled types are
  treated as unknown (magic sniff is the backstop) so obscure-but-valid audio isn't false-rejected.
  Rejection → `415` (`ResponseCodes.UNSUPPORTED_MEDIA_TYPE`).

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
- Texts engine: `$lib/db/server/v1-texts.ts`; ordering `$lib/api/v1/fractional-index.ts`.
- Feedback: `$lib/server/agent-feedback.ts` (limiter + `submit_agent_feedback`) →
  `routes/api/v1/dictionaries/[id]/feedback/+server.ts`.
- Input shapes/helpers: `$lib/api/v1/entry-input.ts` (`resolve_client_id`, `is_uuid`,
  `to_multistring`, `to_string_array`). Spec: `$lib/api/v1/openapi.ts` (+ `openapi.test.ts`
  compile-time key inventory that fails if the TS shapes drift from the published schema).
- Routes: `routes/api/v1/**` (entries CRUD + `…/sentences/{id}`, `…/senses/{id}`, `…/texts`(+`/{textId}`),
  `…/feedback`, `…/tags/{id}`, `…/dialects/{id}`, `…/entries/{entryId}/tags|dialects/{id}`,
  speakers/tags/dialects/sources collections, dict meta, `openapi.json`, landing).

## Text audio reads, writable timings, media download URLs (2026-07-17)

Built for the first real external consumer — Poly Tutor's 文山话 (`wenshanhua`)
Tutor↔LD bridge; requirements arrived as a live `POST …/feedback` message (prod
thread `3eb63b49…`, itself an end-to-end test of the feedback channel). Decisions:

- **`GET …/texts/{textId}` is the one-call full read**: sentences + text-level
  `text.audio` + `sentences[].audio` (each with `timings` + `download_url`) +
  deduped FULL `text.speakers` records. Arrays present only when non-empty.
  Decoration of `download_url` happens at the ROUTE layer
  (`add_audio_download_urls` in `v1-texts.ts`) because only the route knows the
  request origin.
- **Bytes are exposed via a redirecting endpoint**, NOT raw firebasestorage URLs:
  `GET …/media/{...storage_path}` verifies the path belongs to a media row in
  THIS dictionary (keeps private dicts behind key scoping), then 302s to
  `url_from_storage_path` (firebasestorage in prod, `/api/dev-media` in dev).
  Rationale: stable consumer URL that survives a future storage-backend move.
- **`timings` is audio-only in the API** (videos have the column too but no
  consumer; attach 400s on non-audio timings). Accepted on audio attach (object
  in JSON, JSON string in multipart) and via
  `PATCH …/texts|sentences/{ownerId}/audio/{audioId}` `{ timings }` (whole-object
  replace, `null` clears) — the post-upload forced-alignment write-back path.
  Entry audio has NO timings PATCH (timings are sentence-keyed). Validation is
  deliberately lenient: any string→string map.
- **Snapshot tip is docs-only** (landing + openapi info description): public AND
  unlisted dicts → `https://snapshots.livingdictionaries.app/dictionaries/{id}.db.gz`,
  rebuilt ≤~30 min after an edit, `Cache-Control: max-age=120`. Jacob explicitly
  wanted the cadence note; explicitly NO `snapshot` field on API responses.
