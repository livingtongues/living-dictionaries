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
 * `MOCK_USER_ID`. The legacy content reseed (from `src/lib/mocks/
 * dummy-entries.ts`) was retired at the platform cutover; if achi.db is ever
 * missing/wrong, re-pull `.data` from the example repo.
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

// The media/db-ops e2e flows navigate to the fixed test entry `e_ja` ("water") and
// expect editor affordances + a sense to attach media to. The canonical achi content
// fixture (13 `e_*` entries) can go missing on a machine that pulled the REAL achi dict
// into `.data` instead — so ensure the minimum test entry + sense exist here rather than
// depending on a fixture file that isn't in the repo. Idempotent: `INSERT OR IGNORE`
// leaves the full fixture untouched when it's already present.
const achi_db_path = join(data_dir, 'dictionaries', `${DICTIONARY_ID}.db`)
try {
  const achi = new Database(achi_db_path)
  const has_entries = achi.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='entries'").get()
  if (has_entries) {
    achi.prepare(
      `INSERT OR IGNORE INTO entries (id, lexeme, created_by_user_id, created_at, updated_by_user_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('e_ja', JSON.stringify({ default: 'ja\'' }), MOCK_USER_ID, now, MOCK_USER_ID, now)
    achi.prepare(
      `INSERT OR IGNORE INTO senses (id, entry_id, glosses, created_by_user_id, created_at, updated_by_user_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('se_ja', 'e_ja', JSON.stringify({ en: 'water' }), MOCK_USER_ID, now, MOCK_USER_ID, now)
  }
  achi.close()
  console.info(`✓ ensured achi.db test entry e_ja ("water") + sense se_ja`)
} catch (error) {
  console.warn(`⚠ could not seed achi.db test entry (${achi_db_path}): ${error instanceof Error ? error.message : error}`)
}

console.info(`✓ seeded shared.db: ${ACHI_MANAGER_EMAIL} (${MOCK_USER_ID}) as MANAGER of ${DICTIONARY_ID}`)
