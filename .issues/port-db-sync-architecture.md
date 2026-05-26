# Port DB + sync architecture from house → LD `site/`

This is the L2 follow-up from `.issues/port-shared-bones-from-house.md`. We've now done a full design interview (across two prior sessions) and locked in most of the architecture. This file captures all decisions and the remaining questions before we start writing code.

> **Status (2026-05-25)**: design interview through Q10 sub-questions is pending. All Q1–Q9 decisions locked. Q10 (per-dictionary.db migrations strategy) was asked but never answered — that's the next blocker before coding starts.

---

## The three sync stories

LD has **three distinct sync actors**, each with a clearly different read/write pattern. We're planning each independently and writing decisions down per story. (Per-user personal data like notes/bookmarks for viewers is explicitly **not** on the roadmap.)

### Story A — Admin sync (shared.db ↔ admin.db)
**Who:** Users with `admin_level >= 1` (editor admins) and `admin_level === 2` (super-user/dev admins).
**Data:** Catalog metadata, users, dictionary_roles, invites, message_threads + messages (Phase-2 email), client_logs.
**Direction:** Bidirectional. Admins can edit dictionaries catalog rows, manage user roles, send invites, reply to inbound messages.
**Transport:** `/api/admin-sync` (house's pattern, carbon-copy).
**Client storage:** wa-sqlite + IDBBatchAtomicVFS, **main thread**.

### Story B — Editor sync (per-dictionary.db, bidirectional)
**Who:** Anyone with a `dictionary_roles` row for the dictionary (editor/manager/admin role) + super-users.
**Data:** One full `dictionaries/{id}.db` per dictionary they edit. Entries, senses, audio, video, photos, tags, dialects, speakers, all junctions.
**Direction:** Bidirectional. They push edits + new content; pull deltas from other co-editors.
**Transport:** `GET /api/dictionary/[id]/db` (fresh snapshot, bypasses R2) for first fetch; `GET/POST /api/dictionary/[id]/changes` for deltas thereafter.
**Client storage:** wa-sqlite + OPFS VFS, **SharedWorker** (one per origin, all tabs connect via port; OPFS-SyncAccessHandle requires worker context).

### Story C — Viewer sync (per-dictionary.db, pull-only from R2)
**Who:** Anyone — anonymous visitors + logged-in users with no role on the dictionary.
**Data:** Same `dictionaries/{id}.db` shape as editors, but pulled from R2 (cached snapshot, no fresh-from-VPS path).
**Direction:** Pull-only. No push permission. The 30-min cron freshness is acceptable; deltas catch up to live via `/changes`.
**Transport:** `GET https://snapshots.livingdictionaries.app/dictionaries/{id}.db.gz` (R2, fixed key, public, 2-min CDN cache), then `GET /api/dictionary/[id]/changes?since=<cursor>` for incrementals.
**Client storage:** Same as editors — wa-sqlite + OPFS VFS in SharedWorker (shared across all tabs of the origin). Pre-iOS-17 fallback = MemoryVFS (re-fetch every session).
**Eviction:** LRU at 200 MB total OPFS budget (editors exempt).

---

## Reference: parallel issues

- **`.issues/port-shared-bones-from-house.md`** — parent issue; this work is L2.
- **`.issues/migrate-supabase-users-to-new-site.md`** — one-shot Supabase→sqlite migration; many of the schema decisions below directly affect what the migration script writes.

---

## Architecture summary (locked decisions)

```
SERVER (VPS, /var/lib/site/)              R2 BUCKET (Cloudflare)
─────────────────────────────────         ──────────────────────────────────────
shared.db (better-sqlite3)                dictionaries/{id}.db.gz
   - users, email_codes, email_aliases     ▲ overwritten by 30-min cron when
   - dictionaries (catalog)                │ dict's updated_at > snapshot_uploaded_at
   - dictionary_roles                      │ (Cache-Control: max-age=120)
   - invites                               │
   - message_threads, messages,            │
     message_attachments                   │
   - client_logs                           │
                                           │
dictionaries/{id}.db × N (better-sqlite3)──┘
   - entries, senses, sentences, senses_in_sentences
   - audio, audio_speakers, speakers
   - videos, video_speakers, sense_videos, sentence_videos
   - photos, sense_photos, sentence_photos
   - tags, dialects
   - entry_tags, entry_dialects
   - deletes (sync vehicle), migrations, db_metadata


SERVER ENDPOINTS
─────────────────────────────────
POST /api/dictionary/[id]/changes        — editor push (auth required)
                                          → writes to live dictionaries/{id}.db
                                          → trigger bumps db_metadata.last_modified_at
                                          → push endpoint mirrors to shared.db.dictionaries.updated_at
GET  /api/dictionary/[id]/changes?since=  — incremental pull (visitor or editor)
                                          → fast-bails if dict.last_modified_at <= cursor
GET  /api/dictionary/[id]/db              — fresh full snapshot (editor, Authorization bypasses R2 path)
GET  /api/admin-sync                      — shared.db ↔ admin.db sync (house's pattern, ported)


CLIENT
─────────────────────────────────
admin.db        (admins only)  — wa-sqlite + IDBBatchAtomicVFS, MAIN THREAD (house pattern)
                                  bidirectional sync of shared.db subset via /api/admin-sync

dictionaries/{id}.db (everyone) — wa-sqlite + OPFS VFS, SHARED WORKER (one per origin, all tabs connect)
                                  - Visitor first visit:    fetch R2 dictionaries/{id}.db.gz (fixed key)
                                                            → write to OPFS → open in SharedWorker
                                                            → /changes?since=db_metadata.last_modified_at to catch up
                                  - Visitor subsequent:     open existing OPFS file → /changes
                                  - Editor first visit:     fetch /api/dictionary/[id]/db (auth) → OPFS
                                                            → bidirectional /changes thereafter
                                  - Pre-iOS-17 fallback:    MemoryVFS, re-fetch every session
                                  - Multi-tab same dict:    all tabs connect to same SharedWorker instance;
                                                            mutations broadcast to other tabs via port messages
```

---

## Decisions locked (Q1–Q9 from the design interview)

### Q1 — DB path
**✅ (A) Carbon-copy house's stack.** `better-sqlite3` on VPS as `shared.db` + per-dictionary `dictionaries/{id}.db`. `wa-sqlite` in browsers. Own sync engine. Drizzle for types only.

Legacy LD Supabase becomes one-shot migration source on flip-over day; old-site stays running until then.

### Q2 — `shared.db` vs `dictionaries/{id}.db` split

**`shared.db` (server-canonical, sync subset to admins via `admin.db`):**
| Table | Notes |
|---|---|
| `users` | Auth identity |
| `email_codes`, `email_aliases` | Auth plumbing, server-only |
| `dictionaries` | Full catalog row — name, alternate_names, gloss_languages, location, coordinates, iso_639_3, glottocode, public, print_access, metadata jsonb, entry_count, orthographies jsonb, featured_image, author_connection, community_permission, copyright, url |
| `dictionary_roles` | Access control: `(dictionary_id, user_id, role)` |
| `invites` | Admin-managed |
| `message_threads`, `messages`, `message_attachments` | Phase-2 email backend |
| `client_logs` | Server-only |

**`dictionaries/{dictionary_id}.db` (one file per dictionary):**
| Table | Notes |
|---|---|
| `entries` | Headwords |
| `senses`, `senses_in_sentences`, `sentences` | Definitions + examples |
| `audio`, `audio_speakers`, `speakers` | Pronunciation media |
| `videos`, `video_speakers`, `sense_videos`, `sentence_videos` | Video media |
| `photos`, `sense_photos`, `sentence_photos` | Image media |
| `tags`, `dialects`, `entry_tags`, `entry_dialects` | Per-dictionary lookups |
| `deletes`, `migrations`, `db_metadata` | Per-DB sync plumbing |

**Hardcoded TS enums (no DB row):** `parts_of_speech`, `semantic_domains` (already in `packages/old-site/src/lib/mappings/*.ts`).

**Cross-cutting rules:**
- No `users` table inside dictionary.db — just `created_by_user_id` / `updated_by_user_id` text refs plus snapshotted display fields (matches house's email-from-snapshot pattern).
- Dictionary catalog metadata canonical in `shared.db`, NOT mirrored in dictionary.db.

### Q3 — Sync sectors / access matrix (major reframing happened mid-interview)

**Locked model:**
- `shared.db` is **server-only** + admins sync a subset into a local `admin.db`. No sectored sync to visitors/users/editors of shared.db.
- Visitors get **snapshot download** of `dictionaries/{id}.db` from R2 (CDN-cached, see Q4/Q6).
- Editors get fresh snapshot from VPS directly + bidirectional incremental sync.
- "What dicts do I have a role on?" = plain REST + `PersistedState` cache refreshed once per visit.
- Manager settings page (editing roles) = plain REST, no sync.
- Private dictionaries are URL-reachable but unlisted in catalog UI. Same R2 URL pattern.

**Admin levels (verified in legacy):**
- `0` = regular user
- `1` = editor admin (`> 0` gates: delete-dictionary, upload endpoints)
- `2` = super-user/dev admin (`> 1` and `=== 2` gates: settings page, dev fields, v4-internal tags)
- No level 3 actually used (despite legacy comments).

### Q4 — Snapshot delivery (REPLACED by Q6's R2 pivot)

Initial recommendation was `db.backup()` to temp file streamed with 12-hour Cloudflare TTL. **Replaced by Q6.**

### Q5 — Soft-delete vs hard-delete

**✅ (A) Soft-delete everywhere** (carbon-copy legacy LD model).
- Every content table has `deleted TIMESTAMP` column (NULL = visible).
- `deletes` table is a **sync vehicle**: insert into `deletes(table_name, id)` fires a trigger that sets target row's `deleted = NOW()`. Row never physically removed.
- Sync engine pulls/pushes `deletes` rows to propagate soft-delete.
- UI filters `WHERE deleted IS NULL` everywhere.

**Sub-decisions:**
- ✅ Visitor snapshot includes all rows (leaky model — confirmed in Q7 we don't care about hiding private/admin tags from visitors).
- ✅ Compaction policy: defer.
- ✅ Drop `content_updates` audit log from day one. Rely on `updated_at` cursor for change subscription.
- ✅ Port `set_created_by` trigger from legacy (preserves original creator on UPDATE).
- ✅ Cross-DB `dictionaries.updated_at` cascade: push endpoint updates `shared.db.dictionaries.updated_at` on every dictionary.db push. Single source of truth.
- ✅ `entry_count` maintained by push endpoint (increment on insert, decrement on soft-delete); recomputed by daily cron for self-healing.

### Q6 — Snapshot delivery (R2 pivot)

**✅ R2 + 30-min smart cron** (pivoted away from on-demand `db.backup()` due to VPS bandwidth concerns).

**Cron flow (every 30 min):**
```sql
SELECT id FROM dictionaries WHERE updated_at > COALESCE(snapshot_uploaded_at, '1970-01-01')
```
For each changed dict: `db.backup()` → gzip → `PutObjectCommand` to R2 → update `snapshot_uploaded_at`.

**R2 key naming (revised 2026-05-25):** `dictionaries/{id}.db.gz` — single fixed key per dict, overwritten in place each cron pass. `Cache-Control: public, max-age=120` (2 min). No `latest.json` pointer file, no cleanup cron, no versioning.

Trade-off accepted: more cache misses, slightly higher R2 origin load. For LD's traffic scale (~5M Class B reads/month max), this is well within R2's free tier (10M/month). Engineering simplification (no pointer file, no cleanup sweeper, no versioning logic) wins clearly. If we ever hit serious scale (50M+/month), can revisit and add versioned keys then.

**Cost:** R2 storage ~$0.38/mo + Class A writes ~$0.13/mo + $0 egress = **<$1/month total**.

**Worst-case freshness:** snapshot 30 min stale → `/changes` immediately catches up to live.

**Server build mechanism:** `db.backup()` to temp file → gzip → upload to R2 → unlink. Safe under WAL concurrent writes (page-by-page copy under SHARED lock).

**Cron implementation:** `setInterval` inside the SvelteKit process triggered from `hooks.server.ts`, with `start_worker_once` guard (tutor's pattern).

**Editors bypass R2 entirely**: hit `/api/dictionary/[id]/db` with `Authorization` header for fresh snapshot. No staleness window for them.

**Client tech:**
- `admin.db`: wa-sqlite + IDBBatchAtomicVFS, main thread (house pattern).
- `dictionaries/{id}.db`: wa-sqlite + **OPFS VFS, SharedWorker** (one per origin, all tabs share the SharedWorker; deviation from house's main-thread admin.db pattern, accepted to handle the multi-tab + OPFS-exclusive-lock combination).
- Visitor on pre-iOS-17 (no OPFS): graceful degrade to MemoryVFS, re-fetch every session.

**Storage budget / eviction:**
- LRU eviction at **200 MB total** for visitor-only OPFS dictionaries (track `last_accessed_at` in a tiny IDB store).
- Editor dictionaries are exempt from eviction (unpushed dirty rows would be lost).

**Visitor revisit cycle:**
- Open dict-page → read local `db_metadata.last_modified_at` → POST `/changes?since=<cursor>` → apply deltas.
- Re-poll on **focus + explicit refresh button click only**. No background polling.

**Editor concurrent writes:** last-write-wins by `updated_at` (legacy LD behavior).

**Huge delta handling:** if `cursor < (now - 30 days)`, server returns `'snapshot_expired'` sentinel → client refetches full snapshot from R2.

### Q7 — Private tag handling

**✅ Carry-forward leaky model.** R2 snapshot includes ALL tags including private. Client filters by `admin_level` for display. No projection step in the cron.

Rationale (user input): "tags are not sensitive — don't worry about removing them, they're just noise to visitors though so we don't show except for editors of course."

### Q8 — Composite PK vs synthetic UUID for junction tables

**✅ (B) Synthetic UUID + UNIQUE on natural key.** Carbon-copy house.

Affects 10 junction tables: `senses_in_sentences`, `audio_speakers`, `video_speakers`, `sense_videos`, `sentence_videos`, `sense_photos`, `sentence_photos`, `entry_tags`, `entry_dialects` (per-dictionary.db) + `dictionary_roles` (shared.db).

Schema pattern:
```sql
CREATE TABLE sense_videos (
  id         TEXT PRIMARY KEY,
  sense_id   TEXT NOT NULL REFERENCES senses(id) ON DELETE CASCADE,
  video_id   TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted    TEXT,
  UNIQUE (sense_id, video_id)
);
```

**Why:** keeps sync engine a faithful carbon-copy of house — zero special-case branches for `COMPOSITE_PK_TABLES`. `deletes` table stays a uniform `(table_name, id)` shape with no pipe-encoding. Migration script generates UUID v7 for each junction row.

**Cost:** ~1.5 MB extra per dict in gzipped R2 snapshot (~9 MB extra raw per dict). Acceptable.

### Q9 — Dirty marker convention

**✅ (B) `dirty INTEGER` column.** Carbon-copy house.

- NULL/0 = clean, 1 = needs push.
- LiveDb sets `dirty = 1` in JS when row is mutated; sync engine reads `WHERE dirty = 1`; clears with `UPDATE ... SET dirty = NULL` after upload.
- No trigger needed.
- All three apps (tutor, house, LD) end up sharing the same idiom.

Trade-off accepted: lose "when was this dirty?" introspection (not needed for correctness; conflicts resolve on `updated_at`).

---

## Open questions — grouped by sync story

These are the remaining questions to walk through before coding starts. Cross-cutting questions come first, then per-story.

### Cross-cutting (affects all three stories)

#### Q10 — Per-dictionary.db migrations strategy (affects B + C primarily)

Three actors apply schema changes to dict.db: server (lazy + cron), R2 snapshot (built fresh from server-applied schema), client (no migrations — refresh from R2 instead).

**Recommended (from previous session):**
- `shared.db`: explicit boot-time apply in `hooks.server.ts` (carbon-copy from house — fixes the 21h-stale-migration bug they had).
- `dictionaries/{id}.db`: **lazy apply** in `get_dictionary_db(id)` only. The 30-min R2 cron sweep guarantees every dict gets migrated within 30 min of deploy. No separate boot-loop needed.
- **Client never runs migrations.** On opening a dict's OPFS file: compare local schema version (max `migrations.name`) vs app's required version. Stale → discard OPFS file → refetch fresh R2 snapshot.
- **Editor with dirty rows + stale schema** → try push first; if push succeeds, refetch; if push fails, block with UI message: "Schema updated. You have N unsynced changes. Please connect to sync, then reload."
- **Push endpoint version-gating:** payload includes `client_schema_version`; reject mismatch with `'schema_outdated'` / `'server_outdated'` sentinels.
- **Migration discipline:** two-phase / three-phase for destructive changes (ADD nullable column = one-phase OK; DROP/RENAME = phased over multiple deploys).

**Sub-questions:**

1. ✅ **Smart boot-time sweep, gated on a per-dict schema-version column.**
   - **App bundle knows `LATEST_DICT_MIGRATION`** — derived from `import.meta.glob('./dictionary-migrations/*.sql')` at build time (lexicographically-last name).
   - **`shared.db.dictionaries.dict_db_schema_version TEXT NULL`** — last migration applied to that dict.db.
   - **On boot in `hooks.server.ts`:**
     ```ts
     const dicts_needing_migration = shared_db.prepare(`
       SELECT id FROM dictionaries
       WHERE dict_db_schema_version IS NULL
          OR dict_db_schema_version < $latest
     `).all({ latest: LATEST_DICT_MIGRATION })
     if (dicts_needing_migration.length === 0) return // zero work on no-migration deploys
     queueMicrotask(async () => {
       for (const { id } of dicts_needing_migration) {
         await get_dictionary_db(id) // applies + updates dict_db_schema_version
       }
     })
     ```
   - **`get_dictionary_db(id)`** runs pending migrations + updates `dict_db_schema_version` after success.
   - **Benefits:** zero work on no-migration deploys, granular per-dict resumability across crashes, lazy still works as the safety net for newly-created dicts, single source of truth for "is this dict up to date?" (R2 cron can also query it).
2. ✅ **Client runs migrations in the worker (unified for viewers + editors).**
   - Migration SQL files bundled via `import.meta.glob('./dictionary-migrations/*.sql', { eager: true, query: '?raw' })` — shipped to worker, ~5–10 KB total.
   - Worker on opening OPFS file: `SELECT MAX(name) FROM migrations` → compare to `LATEST_DICT_MIGRATION`. If local < bundle, apply missing migrations against the OPFS db.
   - Required discipline: **all migrations are additive at any given moment in time.** Destructive changes (DROP/RENAME COLUMN) go through multi-phase deploys: add → migrate reads/writes → drop. Same rule we'd need regardless (the R2 snapshot is built from the latest server schema; viewers on old bundles must still be able to read it).
   - Editors' dirty rows preserved automatically through additive migrations (ADD COLUMN nullable = no data loss).
   - "Really stale" escape hatch lives in the separate `snapshot_expired` sentinel (`cursor < now - 30 days` → discard + refetch from R2), independent of the migration story.
   - One code path for everyone — no per-actor branching.
3. ✅ **Push endpoint requires `client_schema_version === server_schema_version`.** Since editors run client-side migrations, they should always be up-to-date when pushing. If somehow they're not (e.g. they edited offline, then come online to a deployed-since-last-load app), the response sentinel is `schema_outdated` → client reloads its bundle, re-applies migrations, retries push.
4. ✅ **Not an issue under the unified client-migration model.** Dirty rows survive the migration; push proceeds normally. The old "block with sync-first UI" flow was needed only under "client never runs migrations" — now obsolete.
5. ✅ **Multi-phase migration discipline.** All migrations must be additive at any given moment in time. Destructive changes (DROP/RENAME COLUMN, drop table, narrow type) go through 4 deploys:
   - Deploy 1: add new alongside old; write to both.
   - Deploy 2: switch reads to new; keep writing both.
   - Deploy 3: stop writing old.
   - Deploy 4: drop old.
   The alternative (force page reload on app version change) doesn't help because we can't force-reload anonymous viewers — R2 snapshots from the new schema still have to be readable by old-bundle clients in the wild. Same discipline as house's `architecture/sqlite-migration-gotchas.md`.

#### Q-shared.1 — `db_metadata` keys (locked)

**Per-dictionary.db:**
- `last_modified_at` — bumped by trigger on every content write; the sync cursor.
- `schema_version` — explicit copy of the latest applied migration name (faster probe than `SELECT MAX(name) FROM migrations`).
- `dictionary_id` — the dict's own id, so the worker can self-identify what file it opened (defensive — catches "loaded the wrong file" bugs).

**Shared.db:**
- `schema_version` — same.

Defer `first_seeded_at`, `r2_sweep_last_run_at`, etc. until a real need arises.

#### Q-shared.2 — Trigger fan-out for `last_modified_at` (locked)

**✅ (A) Hand-write each trigger in the migration SQL file.** Repetitive but explicit, greppable, version-controlled. When adding a new syncable table in a future migration, the table + its trigger live in the same SQL file → one place to look. Avoids hidden code-gen indirection.

#### Q-shared.3 — Sync sectors / lanes (locked)

**✅ ONE sector per db. No lanes.**

- `dictionaries/{id}.db`: all 17 tables sync together. Single watermark in `db_metadata.synced_up_to_at`. Single dirty flag → one HTTP roundtrip per sync.
- `shared.db` → `admin.db`: one sector. Single watermark.

**Why no lanes (deviation from tutor's `SECTORS` design):**
- LD's editing unit is "an entry with its full graph" — every meaningful edit dirties content + media + junction tables simultaneously. Tutor's `words/texts/chats/videos/notes` are truly independent user activities; LD's tables interlock.
- Cross-lane FKs (e.g. `sense_videos.sense_id` → `senses.id` would cross content↔media lanes) would risk transient FK failures if lanes sync out of order. Tutor avoids this by guaranteeing no cross-sector FK; LD can't.
- The "fast push just one lane" speedup that motivates tutor's design evaporates for LD.

**What we drop from house/tutor's sync engine:**
- `SECTORS` map, `TABLE_TO_SECTOR` map.
- `dirty_sectors` per-sector tracking.
- Per-sector watermarks in `db_metadata`.
- The sector loop in `sync_sectors` → reduced to a single sync.

**If lanes ever become valuable** (mobile data saver, mega-dict partial views, etc.) we revisit. Not building speculatively.

---

### Story A — Admin sync (shared.db ↔ admin.db)

#### Story A.1 — Which tables sync to admin.db (locked)

| Table | Sync to admin.db? | Notes |
|---|---|---|
| `users` | ✅ admin | Full row. Admins manage users, see activity, promote/demote, look up email contacts. |
| `email_codes` | ❌ server-only | OTP plumbing. Codes are short-lived secrets. |
| `email_aliases` | ❌ server-only | Mail-routing plumbing. |
| `dictionaries` | ✅ admin | The catalog. Admins edit catalog metadata. |
| `dictionary_roles` | ✅ admin | Admins grant/revoke any user's role on any dict. |
| `invites` | ✅ admin | Admins create/cancel invites, see pending. |
| `message_threads` | ✅ admin (when L4 lands) | Phase-2 support inbox. Added with email-backend port. |
| `messages` | ✅ admin (when L4 lands) | Same. |
| `message_attachments` | ✅ admin (when L4 lands) | Metadata only; bytes in R2. |
| `client_logs` | ❌ server-only | Volume could be huge; admin queries via dedicated endpoint. |

#### Story A.2 — Sync engine sector enum (locked, simplified)

Since we have no lanes (Q-shared.3), each table just needs a single flag: `admin` (syncs both directions to admin.db) or `server-only` (never leaves shared.db). The sync engine reads this flag to filter which tables to push/pull. No multi-sector loops, no per-sector watermarks. Shape:

```ts
// lib/db/schemas/shared.ts (or similar)
export const SHARED_TABLE_SYNC: Record<SharedTableName, 'admin' | 'server-only'> = {
  users: 'admin',
  email_codes: 'server-only',
  email_aliases: 'server-only',
  dictionaries: 'admin',
  dictionary_roles: 'admin',
  invites: 'admin',
  client_logs: 'server-only',
  // message_* added with L4
}
export const ADMIN_SYNC_TABLES = Object.entries(SHARED_TABLE_SYNC)
  .filter(([, v]) => v === 'admin').map(([k]) => k) as SharedTableName[]
```

The single `admin-sync` endpoint and the client's sync engine both iterate `ADMIN_SYNC_TABLES`.

#### Story A.3 — Admin vs manager role-editing split (locked)

Two personas, two paths:

- **Site admins** (`admin_level >= 1`): `dictionary_roles` is a synced table in admin.db. Their UI mutates rows via LiveDb → sync pushes changes. Same flow as any other admin-edited table.
- **Dictionary managers** (`dictionary_roles.role = 'manager'` on a specific dict, NOT a site admin): plain REST endpoints scoped to their dict. No admin.db. No sync.
  - `GET    /api/dictionaries/[id]/roles` — server filters `WHERE dictionary_id = $1`; gate checks requester has manager role on this dict
  - `POST   /api/dictionaries/[id]/roles` — create role row OR send invite (same gate)
  - `DELETE /api/dictionaries/[id]/roles/[user_id]` — revoke (same gate)
  - All read/writes hit shared.db directly server-side. No client-side role cache beyond the immediate page.

**Why:** keeps admin.db a clean "admins-only mirror" without per-row filtering inside the sync engine. Managers' settings page is low-frequency / instant-feedback / online-only — REST is the natural fit. Invites flow can be folded into the same `POST /roles` endpoint (creates role row if account exists; creates `invites` row otherwise).

#### Story A.4 — `message_threads` / `messages` sync timing (locked)

Defer schema + sync until L4 (Phase-2 email backend) lands. When it does: tables land in shared.db with `'admin'` sector flag → ride in alongside the rest of admin.db sync via the same endpoint. No special handling.

### Story B — Editor sync (per-dictionary.db, bidirectional)

#### Story B.1 — Worker architecture (locked: SharedWorker + main-thread `$state`)

**Constraint:** OPFS `SyncAccessHandle` (which wa-sqlite OPFS VFS requires) is Web-Worker-only. Multiple tabs on the same dict each having their own Worker would either block each other (exclusive OPFS lock) or duplicate the data and require cross-tab byte transfers.

**Locked architecture: SharedWorker per origin** (universal browser support as of Safari 16.4, March 2023).

- **One SharedWorker per origin.** Holds an LRU cache of open wa-sqlite instances (one per dict the origin has open). Each instance owns its OPFS SyncAccessHandle.
- **Each tab opens a port to the SharedWorker** and posts commands. SharedWorker is dumb-storage-that-speaks-SQL: `open(dict_id, has_editor_role)`, `exec(sql, params)`, `query(sql, params)`, `close(dict_id)`. Per-tab `tab_id` accompanies each command so the SharedWorker can filter broadcasts.
- **Main thread (per tab) owns `$state` row proxies** — same as house's LiveDb pattern, Svelte 5 reactivity stays granular.
- **Mutations**: tab mutates main-thread proxy (Svelte reactivity fires immediately) + posts SQL to SharedWorker → SharedWorker commits to OPFS → broadcasts `{ type: 'rows_changed', dict_id, table, rows }` to all OTHER connected ports for that dict.
- **Receiving tabs** apply the broadcast by diffing rows against their `$state` arrays and patching changed properties in place (preserves per-property reactivity, same trick legacy LD already uses for PGlite arrivals).
- **Sync engine lives inside the SharedWorker** — runs `/changes?since=` periodically per open dict. If any connected tab has editor role, push is included; otherwise pull-only. One sync per dict per origin, regardless of how many tabs are open.

**Why SharedWorker over regular-Worker-per-tab + BroadcastChannel:**
- One source of truth for wa-sqlite state per dict per origin → eliminates cross-tab byte-transfer/race/duplication
- Memory efficient: 50 MB dict open in 3 tabs = 50 MB total, not 150 MB
- No "this tab is read-only" complication — any tab the user has open can edit if they have the role; SharedWorker serializes writes
- No re-fetch from R2 when opening a dict in a second tab — the data's already in the SharedWorker's instance
- Sync engine runs once per origin, not per tab — no election logic, no duplication
- Cross-tab live updates are essentially instant (postMessage latency)

**Worker RPC surface:** ~5 commands (`open`, `exec`, `query`, `close`, plus per-port `bye` on tab unload for refcount management). Once written, never touched.

**Initial fetch path inside SharedWorker:**
| Local OPFS state | User role | Action |
|---|---|---|
| File exists, schema current | any | Open it, ready |
| File exists, schema stale | any | Apply pending migrations to OPFS file (Q10.2) |
| No file | editor/manager/admin | Fetch `GET /api/dictionary/[id]/db` with auth (fresh VPS snapshot) → write OPFS → open |
| No file | viewer | Fetch `https://snapshots.livingdictionaries.app/dictionaries/{id}.db.gz` (R2, fixed key) → write OPFS → open |
| OPFS unavailable (pre-iOS-17) | any | MemoryVFS fallback, re-fetch each session |

**Refcount lifecycle:** SharedWorker tracks per-dict connection count from open ports. When the count for a dict drops to 0, close its OPFS handle and free the wa-sqlite instance. SharedWorker itself dies after all ports disconnect.

**Cache size:** full table caching on main thread (per tab) is what house does today — acceptable for typical dicts. For mega-dicts we'd add server-side pagination later; not day-one work.

#### Story B.2 — Editor's "first fetch" path (locked)

- `GET /api/dictionary/[id]/db` with `Authorization` header.
- Server: `verify_auth_dict_role(event, id, 'editor')` → `db.backup('/tmp/...')` on the live dictionaries/{id}.db → gzip → stream → unlink temp.
- Client: SharedWorker receives bytes, writes to OPFS file via async OPFS API, opens with `createSyncAccessHandle()`, ready.
- Subsequent fetches use `/api/dictionary/[id]/changes` for incrementals.

#### Story B.3 — Push/pull endpoint shape (locked)

`POST /api/dictionary/[id]/changes` does both push (client's dirty rows + tombstones up) and pull (server's deltas since cursor down) in one atomic roundtrip.

**Request:**
```ts
interface DictChangesRequest {
  synced_up_to: string | null    // client's cursor (server-issued from prior response)
  dirty_rows: {
    entries?: SyncRow<'entries'>[]
    senses?: SyncRow<'senses'>[]
    // ... all 17 syncable dict tables
  }
  deletes: { table_name: string, id: string }[]
  latest_dict_migration: string  // e.g. '20260602_add_etymology.sql' from bundle
}
```

**Response (success):**
```ts
interface DictChangesResponse {
  new_synced_up_to: string  // server reads db_metadata.last_modified_at
  changes: {
    entries?: SyncRow<'entries'>[]
    // ... rows updated since cursor by OTHER editors
  }
  deletes: { table_name: string, id: string }[]
}
```

**Error sentinels (4xx/5xx with `{ error: code }`):**
| Status | Code | When |
|---|---|---|
| 401 | `unauthorized` | No valid auth token |
| 403 | `role_revoked` | User no longer has editor+ role on this dict (fresh DB lookup per push — Story B.5) |
| 409 | `schema_outdated` | `latest_dict_migration` < server's bundled latest → client reloads page + re-applies migrations |
| 503 | `server_outdated` | Server's bundled latest < `latest_dict_migration` → mid-deploy, client retries shortly |
| 410 | `snapshot_expired` | Gap between cursor and `last_modified_at` > 60 days (Story C.6) |
| 422 | `validation_failed` | Malformed payload (rare; defense-in-depth) |

**Server-side flow:**
1. `verify_auth` + `verify_auth_dict_role(event, id, 'editor')` (admin bypass via `admin_level === 2`)
2. Check `latest_dict_migration` matches server's → else 409/503
3. Read `db_metadata.last_modified_at` → check gap vs cursor → else 410 or fast-bail empty response (Story C.6)
4. `BEGIN TRANSACTION`
5.   For each table in `dirty_rows`: UPSERT (last-write-wins by `updated_at`)
6.   For each delete: INSERT INTO `deletes` (triggers soft-delete via Q5 trigger)
7.   For each syncable table: SELECT * WHERE `updated_at > cursor AND updated_at <= last_modified_at` (filter out self-pushed via `updated_by != current_user_id` or by the cursor trick)
8.   `new_synced_up_to = db_metadata.last_modified_at` (post-write, single key lookup)
9.   UPDATE `shared.db.dictionaries SET updated_at = new_synced_up_to WHERE id = $dict_id` (cross-DB cascade from Q5)
10. `COMMIT`
11. Return `{ new_synced_up_to, changes, deletes }`

**Atomic**: either everything commits or nothing does. Client retries on 5xx. No pagination day-one (deltas stay small per Story C.6).

#### Story B.4 — Concurrent-write coordination (locked: silent last-write-wins)

✅ Pure silent last-write-wins by `updated_at` (Q6). When two editors touch the same row within seconds, the later push silently overwrites the earlier one. Reasons:
- LD's editing model is high-trust, low-concurrency (1-3 active editors per dict typical).
- Adding optimistic-concurrency-control (server-side version check + conflict resolution UI) is several days of work for a problem that hits <1% of edits.
- Loss recovery story for the rare collision: soft-delete preserves history (Q5); a future "entry history / restore" UI can surface "Alice's prior version → restore" without needing live conflict detection.
- Legacy LD ran this for years with no documented user complaints about silent overwrites.

#### Story B.5 — Role lookup on push (locked: fresh DB lookup)

✅ Push endpoint runs `SELECT role FROM dictionary_roles WHERE dictionary_id = $1 AND user_id = $2` on every push. JWT only contains `{ user_id, admin_level }`.

Reasons:
- **Revocation must be immediate.** JWT-cached roles would let a revoked editor keep pushing for up to 30 days until their JWT expires.
- Cost is sub-millisecond (indexed PK lookup) — noise compared to the rest of the push transaction.
- Avoids JWT bloat for users with many roles.
- Admins (`admin_level === 2`) bypass the per-dict role check entirely — admin-level promotion/demotion is still a re-login event.

Helper: `verify_auth_dict_role(event, dict_id, min_role)` — server endpoint helper that checks both admin bypass and dict role.

#### Story B.6 — `GET /api/me/dictionary-roles` cache (locked)

Plain REST endpoint, response stored in `PersistedState` (localStorage-backed), refreshed on app boot if absent or `fetched_at > 1 hour ago`.

**Response shape:**
```ts
interface MyDictionaryRolesResponse {
  fetched_at: string  // server timestamp
  roles: {
    dictionary_id: string
    dictionary_name: string       // denormalized — saves a client-side JOIN
    role: 'editor' | 'manager' | 'admin'
    granted_at: string
  }[]
}
```

**Refresh cadence:** on app boot (if stale), on manual refresh button, on `/login` success (clear+fetch), on logout (clear).

**Admins get only their actual `dictionary_roles` grants** (not all dicts). Admin-level site-wide access is a separate concept exposed via admin.db; this endpoint reflects "things I'm editorially responsible for." Cleaner separation.

**Server cost:** one indexed JOIN query. Sub-millisecond for typical users.

**Stale-cache trade-off:** if an admin grants a role mid-session, the user's cache won't reflect it until their next visit. Acceptable — the dict is still URL-reachable, the push endpoint's fresh role lookup (B.5) handles security regardless, and role grants are rare events.

### Story C — Viewer sync (per-dictionary.db, pull-only from R2)

#### Story C.1 — R2 bucket access model (locked)

- **Public R2 bucket** at custom CNAME `snapshots.livingdictionaries.app` → R2 bucket. No auth, no signed URLs.
- **CORS: `*`.** The data is public; restricting origins is security theater for already-public data. Anyone can `curl` the same URL regardless of CORS. Avoid the "localhost-in-production-CORS" pattern that looks restrictive without being so.
- **SvelteKit `/api/*` endpoints**: same-origin only (default — no `Access-Control-Allow-Origin` headers added). Dev works because Vite serves app + API at the same origin.
- **Private dictionaries are private only in catalog UI sense** — they don't appear in listings but their R2 URL is reachable. Matches legacy LD's "casual obscurity" threat model.
#### Story C.2 — R2 cron singleton (locked)

- `setInterval(30 * 60 * 1000)` inside `hooks.server.ts` guarded by `start_worker_once` (tutor's pattern).
- Day 1: single SvelteKit process per VPS; `globalThis` guard is enough.
- If we ever go PM2 cluster mode: add DB advisory lock check before each tick. Deferred.
- **Builder enable/disable**: `R2_SNAPSHOT_BUILDER_ENABLED` env var checked at boot. Allows cutover-day operation where we run a one-shot pre-warm with the builder off, then turn it on after DNS flip.

#### Story C.3 — No cleanup needed (revised 2026-05-25)

We use fixed key (`dictionaries/{id}.db.gz`) overwritten in place. Each cron run replaces the prior blob. No accumulation → no cleanup cron needed.

#### Story C.4 — R2 write atomicity (revised 2026-05-25)

`PutObject` to a fixed key is atomic per key in R2 — visitors reading the URL mid-upload either get the previous bytes or the new bytes, never a corrupted mix. No pointer-file swap dance needed.

#### Story C.5 — Cutover-day cold start (locked, plus dedicated issue)

On flip-over day, ~500 dicts need initial R2 snapshots (~25 GB total upload). Approach:
- Pre-cutover (builder OFF, before DNS flip): run a one-shot `bin/build-all-snapshots.ts` script that throttles to ~4 concurrent uploads. Completes in ~30-60 min depending on uplink.
- Verify a sample of dicts loads correctly via R2 URLs.
- DNS cutover.
- Turn builder ON (`R2_SNAPSHOT_BUILDER_ENABLED=true` + restart, or live-reload env). From now on, the 30-min cron only touches changed dicts (tiny per-cycle workload).

See `.issues/cutover-from-legacy-supabase.md` for full sequence (to be created).

#### Story C.6 — Long-absent visitor handling (locked, refined)

Server-side check on `/api/dictionary/[id]/changes?since=<cursor>`:

```ts
const last_modified_at = read_db_metadata('last_modified_at') // single-key lookup, sub-ms

// 1. Fast bail: nothing has changed since client's cursor
if (last_modified_at <= cursor) {
  return { new_synced_up_to: cursor, changes: {}, deletes: [] }
}

// 2. Snapshot expired: gap between cursor and actual latest change > 60 days
if ((last_modified_at - cursor) > 60 * DAY_MS) {
  return new Response(JSON.stringify({ error: 'snapshot_expired' }), { status: 410 })
}

// 3. Normal delta
return compute_delta_since(cursor)
```

**Threshold is data-staleness, not calendar age.** The 60-day check compares against the dict's `last_modified_at`, not `now`. So:
- Inactive dict + long visitor absence = fast bail (no refetch prompt)
- Active dict + long absence = `snapshot_expired` (delta would be large)
- Active dict + short absence = normal delta
- Inactive dict + short absence = fast bail (most common revisit case)

Client on `410 snapshot_expired`:
- Discard local OPFS file
- Refetch fresh snapshot (R2 for viewer, VPS for editor)
- Initial cursor restarts from new snapshot's `last_modified_at`

**Why 60 days:** for LD's edit rates, even pathologically active dicts produce less delta data than a full snapshot in 60 days, so the threshold is about clean-start semantics for very stale clients, not delta size. 60 covers the casual-returning-visitor case generously.

**Why time-based vs row-count-based:** time check is O(1) using already-cached `last_modified_at`; row count requires 17 COUNT queries per request. For LD, delta size isn't actually the bottleneck. If we ever see a dict with pathological edit volume (~50 MB+ deltas at 60 days), add a row-count secondary backstop. Not day-one.

#### Story C.7 — Cursor source (locked)

**Server reads `db_metadata.last_modified_at` from the dict.db** and returns it as `new_synced_up_to` in every push/pull response. Client stores verbatim and sends back on next request.

**Why this is better than wall-clock or per-table MAX(updated_at):**
- `last_modified_at` is already maintained by triggers on every content write (Q-shared.1, Q-shared.2)
- Single-key lookup, sub-ms — no need for 17 MAX queries like tutor does
- Data-grounded: cursor doesn't drift when nothing changes (clean idempotency for re-syncs)
- Same clock domain throughout — server's SQLite `strftime('now')` at trigger time
- The trigger fires AFTER all row writes in a transaction, so `last_modified_at >= max(row.updated_at)` — filtering `updated_at > cursor` correctly excludes just-pushed rows

Cleaner than both tutor's MAX-across-tables and my originally-proposed wall-clock approach.

#### Story C.8 — Mid-session role grant (locked)

When an admin grants a user a new editor role mid-session:
- User must **reload the page** to pick up the new role.
- On reload: app boot fetches fresh `/api/me/dictionary-roles` → cache reflects new role.
- User navigates to the dict → page detects editor role → SharedWorker enables push side of sync → editor UI unlocks.
- **No data refetch needed** — the OPFS file from viewer mode is already current; just push capability is now unlocked.
- UX for admins doing role grants: communicate "refresh your page to start editing" out-of-band. Same pattern legacy LD used.

Auto-detection of role changes mid-session (without reload) is possible via periodic re-fetch of `/api/me/dictionary-roles` or server-push (SSE/WebSocket), but neither is day-one work.

#### Story C.9 — Auth'd visitor with no role (locked)

For a specific dict where the user has no role, **identical to anonymous visitor**. No middle tier.

- Snapshot from R2 (not VPS)
- Pull-only via `/changes`
- Read-only viewer UI

What still differs from anonymous (elsewhere on the site, not on this dict's page):
- Header shows username/avatar
- Can access `/me/...` endpoints
- `dictionary-roles` cache may show OTHER dicts where they have roles
- Visit logging may differ for analytics

Role check happens per-dict-on-first-open. Editor/manager/admin role on this dict → editor flow (fresh VPS + push). No role or anonymous → viewer flow (R2 + pull-only). Two paths, no middle.

---

## Implementation order (when we start coding)

Organized by sync story. Earlier stories are prerequisites for later ones.

### Story A — Admin sync (shared.db ↔ admin.db) — DO FIRST

This is the foundation. No dict.db work makes sense until the shared.db catalog is queryable on the server and syncable to admins.

1. `lib/db/schemas/{shared.ts, shared.types.ts, json-columns.ts, shared-migrations/}` — port from house.
2. First shared-migration `YYYYMMDD_initial.sql` — `users`, `dictionaries` catalog, `dictionary_roles`, `invites`. (Auth-plumbing tables `email_codes`, `email_aliases` come in with L3 auth port.)
3. `lib/db/server/{shared-db.ts, sync-helpers.ts, run-sql-migrations.ts, typed-query.ts}` — port from house.
4. `hooks.server.ts` — boot-time `get_shared_db()` call so migrations apply at boot (the 21h-stale fix from house).
5. `lib/db/client/{connection.ts, db.ts, live/}` — wa-sqlite + LiveDb (admin.db only — IDBBatchAtomicVFS, main thread).
6. `lib/db/sync/{engine.svelte.ts, errors.ts, history.svelte.ts, types.ts, SyncStatus.svelte}` — port from house.
7. `routes/api/admin-sync/+server.ts` — port from house, scoped to LD's table set.
8. Sector enum: tag each table as `admin` (bidirectional sync to admins) or `server-only` (auth plumbing).
9. **Verify:** admin can log in (requires L3 auth — parallel work), `admin.db` syncs down a `users` row and a `dictionaries` row.

### Story B — Editor sync (per-dictionary.db, bidirectional) — DO SECOND

Editors need to be able to open a dictionary they have a role on, get a fresh snapshot, and push edits.

1. Migrations folder `lib/db/schemas/dictionary-migrations/` + first migration: all content tables (entries, senses, sentences, audio, video, photos, speakers, tags, dialects + all junctions with synthetic UUID PKs + `dirty INT` + `deleted TIMESTAMP` + `deletes` table + `migrations` + `db_metadata`).
2. `lib/db/server/dictionary-db.ts` — LRU cache for `better-sqlite3` connections, lazy migration apply (port from house's `user-db.ts` pattern).
3. `db_metadata.last_modified_at` trigger fan-out — programmatically generated from `tables[]` or hand-written per migration.
4. `routes/api/dictionary/[id]/db/+server.ts` — fresh snapshot for editors (Authorization required → `db.backup()` → gzip → stream).
5. `routes/api/dictionary/[id]/changes/+server.ts` — push (POST) + pull (GET). Push verifies `dictionary_roles` for `(user_id, dict_id)`. Push mirrors `db_metadata.last_modified_at` → `shared.db.dictionaries.updated_at`.
6. **SharedWorker** for client-side dict.db (one per origin, all tabs connect): bootstraps wa-sqlite + OPFS VFS, exposes RPC for `open/exec/query/close`, holds an LRU cache of open wa-sqlite instances (one per dict), runs the sync engine internally (one per open dict regardless of tab count), broadcasts row-change events to other connected tabs.
7. Main-thread shim: connects to SharedWorker via port, mirrors broadcast updates into Svelte 5 `$state` proxies via in-place diff-and-patch (preserves granular reactivity).
8. Client-side dict-instance refcount + LRU eviction at 200 MB total OPFS budget (editors exempt — they have unpushed dirty rows).
9. Adapt sync engine for dict.db scope (per-dict cursor in `db_metadata.last_modified_at`, no lanes per Q-shared.3).
10. **Verify:** editor can open a dictionary, see entries, add a new entry, see it persist on refresh + on a second tab + on a second device.

### Story C — Viewer sync (per-dictionary.db, pull-only from R2) — DO THIRD

Once Story B works, layering R2 + pull-only on top is small.

1. R2 client wrapper in `lib/r2/` — `PutObjectCommand` + `DeleteObjectCommand` + signed-url generation (if ever needed; public bucket means probably not).
2. Cron job in `hooks.server.ts`: `setInterval(30 min)` guarded by `start_worker_once`, gated by `R2_SNAPSHOT_BUILDER_ENABLED` env var (cutover-day kill switch). Queries `dictionaries WHERE updated_at > snapshot_uploaded_at`, runs `db.backup()` → gzip → PUT to R2 at fixed key `dictionaries/{id}.db.gz` with `Cache-Control: public, max-age=120` → update `snapshot_uploaded_at`.
3. Fixed-key R2 strategy (no versioning, no pointer file, no cleanup cron).
4. Client first-fetch flow (no auth): fetch `https://snapshots.livingdictionaries.app/dictionaries/{id}.db.gz` → write to OPFS → open in SharedWorker → call `/changes?since=db_metadata.last_modified_at` to catch up.
5. Pre-iOS-17 fallback: MemoryVFS, re-fetch every session.
7. `/changes` endpoint adds `snapshot_expired` sentinel when `(last_modified_at - cursor) > 60 days` → client refetches from R2. Plus fast-bail when `last_modified_at <= cursor`.
8. **Verify:** anonymous user opens a public dict via the URL, sees content within seconds, comes back tomorrow and gets deltas only.

### Parallel / supporting work

- **L3 Auth port** (parent issue) — Story A can't be verified end-to-end without it.
- **L4 Email/messages backend** (parent issue) — add `message_threads` + `messages` to shared.db only when L4 lands.
- **`verify_auth_dict_role(event, dict_id, min_role)`** helper for the push endpoint and any role-gated routes.
- **Manager REST endpoints** (no sync): `GET/POST /api/dictionaries/[id]/roles` for the settings page.
- **`GET /api/me/dictionary-roles`** for the visitor's "what dicts do I have a role on" `PersistedState` cache.

---

## Lessons learned / discoveries to carry into implementation

- **wa-sqlite does NOT expose `sqlite3_deserialize`** — no native "load .db bytes into memory" API. With `IDBBatchAtomicVFS` (house's pick) you can't bulk-import a .db file. Solution: OPFS VFS, write bytes to file, open natively. iOS 17+ / desktop modern browsers. Pre-iOS-17 fallback = MemoryVFS, re-fetch every session.
- **OPFS-SyncAccessHandle is Web-Worker-only.** Dict.db client code must run inside a worker, not on the main thread. This is a deviation from house's main-thread `admin.db` pattern. `admin.db` stays on main thread (IDBBatchAtomicVFS, no file-bytes issue). LD ends up with two contexts: main-thread for admin.db, **SharedWorker for dict.db** (shared across all tabs of the origin — chosen over per-tab Worker so multiple tabs of the same dict don't fight over the exclusive OPFS handle or duplicate the in-memory data).
- **No COOP/COEP headers needed for OPFS** (confirmed during interview).
- **VPS bandwidth was the real concern that drove the R2 pivot.** 50 GB/day = 1.5 TB/month at scale. R2's $0-egress kills this concern.
- **`db.backup()` is safe under WAL concurrent writes.** Page-by-page copy under SHARED lock; produces consistent .db on disk. ~few hundred ms for 50 MB file.
- **Legacy LD's `set_created_by` trigger** preserves original creator on UPDATE — admins can't take credit. Carry forward.
- **Legacy LD's `update_dictionary_updated_at` trigger** can't span DBs in the new model. Replaced by push-endpoint update (single source of truth).
- **Legacy LD `tags.name.startsWith('v4')` magic** — name-prefix hack to gate super-admin-only tags. Should be replaced with `tags.admin_only BOOLEAN` column at some point; deferred since Q7 confirmed leaky model is fine for now.
- **Legacy LD has 10 junction tables with composite PKs.** Sync engine had `COMPOSITE_PK_TABLES` registry + branching in 6 code paths. Switching to synthetic UUID + UNIQUE eliminates all of that branching.
- **Legacy LD `content_updates` audit log** was used by Orama-via-Supabase-Realtime indexer. New model uses `updated_at` cursor on each table — audit log dropped.
- **R2 cost math:** 500 dicts × 50 MB avg = 25 GB × $0.015/GB/mo storage = $0.38/mo. ~96 cron runs/day × ~10 changed dicts = $0.13/mo writes. Total <$1/mo.
