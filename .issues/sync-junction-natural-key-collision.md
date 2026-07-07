# Server sync merge: natural-key UNIQUE collision on junction rows (per-dict)

**Status:** ✅ **Per-dict `merge_dict_row` fixed + tested (uncommitted).** 📋 **shared.db `merge_row`
audited — NOT exposed (documented below).** The LD sibling-audit of house's `people.name` collision
(`house/.issues/sync-lookup-name-unique-constraint-collision.md`, fixed in house `292f08f`). Jacob
reviews/commits.

## The bug class

house's `merge_row` upserts pushed rows with `ON CONFLICT(id) DO UPDATE`, but its lookup tables carry
a SECOND uniqueness constraint (a natural key). Two clients minting the same natural row with
different client-generated ids → the second INSERT collides on the natural key, `ON CONFLICT(id)`
never fires, the constraint throws, and the whole `BEGIN IMMEDIATE … COMMIT` push rolls back (500).

## LD audit — two merge paths

### ✅ shared.db admin-sync (`sync-helpers.ts` `merge_row`) — NOT exposed

shared.db's syncable tables DO have natural-key UNIQUEs (declared in raw migration SQL, not drizzle
`.unique()`, so a `.unique()` grep misses them):

- `users.email` UNIQUE · `dictionaries.url` UNIQUE · `dictionary_roles` UNIQUE `(dictionary_id,
  user_id, role)` · `invites.token_hash` UNIQUE.

But **none are reachable through the sync push path**, because the admin client never PUSHES a
new-id row for these tables — they are all **created server-side through endpoints** and the admin
client only *pulls* them, later pushing UPDATES to *existing* ids (so `ON CONFLICT(id)` always fires):

- `dictionaries` + creator `dictionary_roles` → `POST /api/dictionaries/create` (server assigns id,
  and pre-checks `WHERE id = ? OR url = ?`).
- `dictionary_roles` / `invites` → `POST /api/dictionaries/[id]/roles`, `/invites/[id]/accept`,
  `/api/email/invite` (server-authoritative writes).
- `users` → the auth flow (server-side).

`token_hash` is a random sha-256 (no human-chosen collision), and the FK-referenced ids
(`users.id`, `dictionaries.id`) are never client-minted. **No change made to `merge_row`** — adding a
guard for an unreachable path would only add risk to the admin-sync hot path.

### ✅ Per-dict content sync (`dictionary-sync-helpers.ts` `merge_dict_row`) — EXPOSED → fixed

This one IS reachable and broad. Every dict junction / lookup table has a synthetic-UUID PK **plus a
UNIQUE natural key** (from `dictionary-migrations/*.sql`):

| table | natural key |
|---|---|
| `senses_in_sentences` | `(sense_id, sentence_id)` |
| `audio_speakers` | `(audio_id, speaker_id)` |
| `video_speakers` | `(video_id, speaker_id)` |
| `sense_videos` / `sentence_videos` | `(sense_id, video_id)` / `(sentence_id, video_id)` |
| `sense_photos` / `sentence_photos` | `(sense_id, photo_id)` / `(sentence_id, photo_id)` |
| `entry_dialects` | `(entry_id, dialect_id)` |
| `entry_tags` | `(entry_id, tag_id)` |
| `featured_entries` | `(entry_id)` |
| `sources` | `slug` |
| `entry_relationships` | functional idx over 6 cols (COALESCE) |

**Reachability confirmed in code:** junction ids are minted with `crypto.randomUUID()`
(`dict-writes.ts` `insert_row`), NOT derived from the natural key. So two editors independently
linking the same pair (e.g. tag T on entry E) mint different UUIDs; the second push's INSERT hits the
natural-key UNIQUE and — with `ON CONFLICT(id)` only — throws `UNIQUE constraint failed`, rolling back
the whole per-dict push. The client's deletes-before-upserts ordering (`24b080b1`) only covers the
*replace-all relink within one window* case, NOT this cross-client different-id race.

## The fix (per-dict)

Ported house's **dedupe-to-existing-id** approach, adapted: since every affected LD table is a **leaf
row** (no other row FK-references a junction id — sources are referenced by `slug`, not id), the fix
needs **no FK-remap / id echo** that house's referenced lookup ids require.

In `merge_dict_row` (`dictionary-sync-helpers.ts`):
- `DICT_NATURAL_KEY_COLUMNS` maps each table → its natural-key columns.
- `find_natural_key_owner_id(...)` looks up the canonical existing id via
  `COALESCE("col",'') = COALESCE(?,'')` (COALESCE so `entry_relationships`' nullable cols match its
  functional index, and NOT-NULL junctions compare as plain equality).
- When the pushed id is unknown but its natural key already belongs to a DIFFERENT id, we dedupe onto
  that **canonical id**: LWW-merge the pushed content onto the existing row (upsert with
  `id = canonical_id`) instead of inserting a duplicate. The history event / `resolve_owners` use the
  canonical id.

Net effect: the colliding push **succeeds** (no 500, no rollback of the batch); the server keeps one
row per natural key. The pushing client keeps its own loser-id row (cleared-dirty after the push, so
it does not re-push) — a harmless id divergence for a duplicated leaf link, vastly better than a hard
500 that wedges the entire push.

**Also used by the v1 write API** (`merge_dict_row` is the shared write path): an agent re-creating an
existing junction now idempotently dedupes instead of 500ing — a parity win.

### Tests

`dictionary-sync.test.ts` → `describe('junction natural-key collision …')` against a real
better-sqlite3 in-memory dict DB (a mock wouldn't fire the constraint):
- two clients push `entry_tags` for the same `(e1, t1)` with different ids → **no throw**, exactly one
  row survives, deduped onto the first (canonical) id with the newer push's content merged.
- a stale (older `updated_at`) duplicate push loses LWW and does not clobber the canonical row.

Verified: `pnpm check` (0 errors), `pnpm eslint`, `pnpm vitest run` (347 passing).

## Known residual (not fixed here — lower severity, document only)

If the server ever ECHOES the canonical row back to a client that still holds the loser id (this fix
deliberately does NOT echo), the client's own `#upsert_row` (`dict-sync-engine.ts`) is also
`ON CONFLICT(id)`-only and would hit the SAME natural-key collision locally on apply — the reverse
direction of the already-known `document_verses` client-side class. We avoid triggering it by not
echoing (leaf rows don't need the canonical id propagated). If a future change needs the client to
adopt the canonical id, `#upsert_row` must first delete a local different-id owner of the natural key
(mirror of this server dedupe). Left as a documented follow-up.
