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
- A key is scoped to ONE dictionary and carries a role (default `manager`). API
  writes are attributed to the key's **creator** (`created_by_user_id`) so history/
  audit name a real human; if that user was deleted, a `apikey:<id>` sentinel keeps
  dict.db's NOT NULL audit columns satisfied.
- `verify_dict_api_access(event, dict_id, min_role)` is the gate for `/api/v1/*`: an
  `Authorization: Bearer ldk_…` key (hash lookup + dict-scope match + role rank) OR
  a normal session/JWT via `verify_auth_dict_role`. Detects an LD key by the `ldk_`
  prefix; a JWT bearer falls through to the session path.

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

## Gotchas worth keeping

- **`+server.ts` may only export HTTP-method handlers** (+ `_`-prefixed). A non-handler
  *value* export (we hit it with batch-size constants) throws "Invalid export …" at
  request time — invisible to unit tests (they import handlers directly) and to
  `lint`/`check`. Always live-smoke a new endpoint over HTTP. Put shared constants in a
  lib module, not the route file. (Type/interface exports are fine — erased.)
- **Entry delete leaves standalone sentences.** The `deletes` tombstone → cascade
  removes the entry, its senses, and the `senses_in_sentences` junction (FK ON DELETE
  CASCADE), but `sentences` rows have no FK to a sense, so they survive (they can
  belong to a text / other senses). This matches the existing human-delete behavior —
  don't "fix" it without deciding orphan policy globally.
- Reads (`GET …`) are key/session gated at `contributor`; writes at `editor`.
  Read endpoints pass `admin_level: 1` to `build_entry_data` so a dict-scoped caller
  sees their own private content (incl. the private import tag).

## Where things live

- Keys: `$lib/api-keys/api-key.ts` + `shared-migrations/20260629_api_keys.sql` +
  `routes/api/dictionaries/[id]/api-keys/*` (manager-gated CRUD) + the Settings panel
  `$lib/components/settings/ApiKeys.svelte`.
- Auth gate: `$lib/auth/verify-dict-api-access.ts`.
- Write engine: `$lib/db/server/v1-entry-write.ts` (`apply_entry_writes` /
  `apply_entry_update` / `apply_entry_delete`) + `v1-sub-resources.ts`.
- Input shapes/helpers: `$lib/api/v1/entry-input.ts`. Spec: `$lib/api/v1/openapi.ts`.
- Routes: `routes/api/v1/**` (entries CRUD, speakers/tags/dialects, dict meta,
  `openapi.json`, landing).
