/**
 * Seed the e2e `achi` editor fixture's auth state into `.data/shared.db`:
 * the non-admin user who MANAGES `achi`, plus their `dictionary_roles` row.
 *
 *   pnpm -F site seed:achi-fixture
 *
 * Why this exists: `e2e/achi-flow.mjs` + `e2e/db-ops-flow.mjs` log in via the dev
 * OTP path as `achi-manager@example.com`, and `can_edit` must resolve from a REAL
 * `dictionary_roles` row (a non-admin manager — NOT an admin bypass). Pulling the
 * full prod catalog into `shared.db` overwrites achi's roles with the real
 * livingtongues managers, so this restores the deterministic test manager.
 *
 * The achi CONTENT fixture (13 entries `e_*`, senses, speakers, audio, dialects,
 * tags) already lives in `.data/dictionaries/achi.db` — every row stamped with
 * `MOCK_USER_ID`. The old Supabase-era content reseed (from `src/lib/mocks/
 * dummy-entries.ts`) was retired with the Supabase stub; if achi.db is ever
 * missing/wrong, re-pull `.data` from the example repo (see
 * `.knowledge/migration/pulling-supabase-data-locally.md`).
 *
 * Idempotent: upserts the user, replaces the achi role row. Safe to re-run while
 * the dev server is up (a small shared.db write the server picks up per-request).
 */
import process from 'node:process'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'

// Stable id shared by the achi-manager user and the achi content fixtures'
// `created_by_user_id` (see the retired src/lib/mocks/mock-user.ts).
const MOCK_USER_ID = '00000000-0000-4000-8000-000000000001'
const ACHI_MANAGER_EMAIL = 'achi-manager@example.com'
const DICTIONARY_ID = 'achi'

const data_dir = process.env.DATA_DIR || '.data'
const shared_db_path = join(data_dir, 'shared.db')
const shared = new Database(shared_db_path)
const now = new Date().toISOString()

shared.prepare(
  `INSERT INTO users (id, email, name, avatar_url, providers, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, providers = excluded.providers, updated_at = excluded.updated_at`,
).run(
  MOCK_USER_ID,
  ACHI_MANAGER_EMAIL,
  'Achi Manager',
  null,
  JSON.stringify([{ provider: 'email', provider_id: ACHI_MANAGER_EMAIL }]),
  now,
  now,
)

shared.prepare('DELETE FROM dictionary_roles WHERE user_id = ? AND dictionary_id = ?').run(MOCK_USER_ID, DICTIONARY_ID)
shared.prepare(
  'INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
).run(randomUUID(), DICTIONARY_ID, MOCK_USER_ID, 'manager', now, now)
shared.close()

console.info(`✓ seeded shared.db: ${ACHI_MANAGER_EMAIL} (${MOCK_USER_ID}) as MANAGER of ${DICTIONARY_ID}`)
