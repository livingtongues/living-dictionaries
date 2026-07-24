/**
 * Seed the local-only `dev` ("Dev Playground") dictionary — the dev/e2e fixture.
 *
 *   pnpm -F site seed:dev-fixture
 *
 * Why a dedicated slug: `dev` does NOT exist in production, so it can never be
 * confused with (or clobbered by) real data — visitors in dev get the documented
 * empty-DB + `/changes` backfill path when the prod R2 snapshot 404s, and its
 * catalog (orthographies, gloss languages, …) can be changed with impunity.
 * (This replaced the old achi-based fixture, which shared its slug with the real
 * production Achi dictionary. If a prod catalog pull ever wipes the local-only
 * row, just re-run this script.)
 *
 * What it does (idempotent, safe while the dev server runs):
 *   1. `.data/dictionaries/dev.db` — copied from the legacy `achi.db` content
 *      fixture when missing (13 `e_*` entries stamped with MOCK_USER_ID).
 *   2. shared.db `dictionaries` catalog row — public, es/en gloss languages,
 *      THREE orthographies (Practical + IPA + Native Script) so orthography
 *      display cases are exercisable.
 *   3. shared.db auth: `dev-manager@example.com` user + a real `dictionary_roles`
 *      manager row (a non-admin manager — NOT an admin bypass) for e2e `can_edit`.
 *   4. dev.db: ensures the fixed e2e test entry `e_ja` ("water") + sense exist.
 *
 * The entries-list VARIETY seed (demo_* entries) lives in seed-variety-entries.ts.
 * Log in as dev-manager@example.com (dev OTP, see dev-auth skill) for editor view.
 */
import process from 'node:process'
import { join } from 'node:path'
import { copyFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'

// Stable id shared by the dev-manager user and the content fixtures'
// `created_by_user_id` (see the retired src/lib/mocks/mock-user.ts).
const MOCK_USER_ID = '00000000-0000-4000-8000-000000000001'
const DEV_MANAGER_EMAIL = 'dev-manager@example.com'
const DICTIONARY_ID = 'dev'

const data_dir = process.env.DATA_DIR || '.data'
const now = new Date().toISOString()

// 1 — content DB: copy the legacy achi.db fixture into dev.db when missing
const dev_db_path = join(data_dir, 'dictionaries', `${DICTIONARY_ID}.db`)
const legacy_achi_path = join(data_dir, 'dictionaries', 'achi.db')
if (!existsSync(dev_db_path)) {
  if (existsSync(legacy_achi_path)) {
    copyFileSync(legacy_achi_path, dev_db_path)
    console.info(`✓ copied legacy achi.db content fixture → ${dev_db_path}`)
  } else {
    console.warn(`⚠ no ${dev_db_path} and no legacy achi.db to copy — the dev server will create an empty schema on first open`)
  }
}

// 2 + 3 — shared.db: catalog row, user, role
const shared = new Database(join(data_dir, 'shared.db'))

const orthographies = [
  { code: 'default', name: 'Practical', primary: true },
  { code: 'ipa', name: 'IPA' },
  { code: 'script', name: 'Native Script' },
]
shared.prepare(
  `INSERT INTO dictionaries (id, url, name, gloss_languages, public, bucket, entry_count, orthographies, created_at, updated_at)
   VALUES (@id, @id, @name, @gloss_languages, 1, 'public', 0, @orthographies, @now, @now)
   ON CONFLICT(id) DO UPDATE SET name = excluded.name, gloss_languages = excluded.gloss_languages,
     public = excluded.public, orthographies = excluded.orthographies, updated_at = excluded.updated_at`,
).run({
  id: DICTIONARY_ID,
  name: 'Dev Playground',
  gloss_languages: JSON.stringify(['es', 'en']),
  orthographies: JSON.stringify(orthographies),
  now,
})

shared.prepare(
  `INSERT INTO users (id, email, name, avatar_url, providers, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, providers = excluded.providers, updated_at = excluded.updated_at`,
).run(
  MOCK_USER_ID,
  DEV_MANAGER_EMAIL,
  'Dev Manager',
  null,
  JSON.stringify([{ provider: 'email', provider_id: DEV_MANAGER_EMAIL }]),
  now,
  now,
)

shared.prepare('DELETE FROM dictionary_roles WHERE user_id = ? AND dictionary_id = ?').run(MOCK_USER_ID, DICTIONARY_ID)
shared.prepare(
  'INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
).run(randomUUID(), DICTIONARY_ID, MOCK_USER_ID, 'manager', now, now)
shared.close()

// 4 — the media/db-ops e2e flows navigate to the fixed test entry `e_ja` ("water")
// and expect editor affordances + a sense to attach media to.
try {
  const dev_db = new Database(dev_db_path)
  const has_entries = dev_db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='entries'").get()
  if (has_entries) {
    dev_db.prepare(
      `INSERT OR IGNORE INTO entries (id, lexeme, created_by_user_id, created_at, updated_by_user_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('e_ja', JSON.stringify({ default: 'ja\'' }), MOCK_USER_ID, now, MOCK_USER_ID, now)
    const has_sense = dev_db.prepare('SELECT 1 FROM senses WHERE entry_id = ? LIMIT 1').get('e_ja')
    if (!has_sense) {
      dev_db.prepare(
        `INSERT INTO senses (id, entry_id, glosses, created_by_user_id, created_at, updated_by_user_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run('se_ja', 'e_ja', JSON.stringify({ en: 'water' }), MOCK_USER_ID, now, MOCK_USER_ID, now)
    }
  }
  const { n } = dev_db.prepare('SELECT COUNT(*) AS n FROM entries').get() as { n: number }
  dev_db.close()
  // Keep the catalog's entry_count honest — the entries page uses it to decide
  // "loading…" vs "no entries yet" during a cold viewer boot.
  const count_shared = new Database(join(data_dir, 'shared.db'))
  count_shared.prepare('UPDATE dictionaries SET entry_count = ? WHERE id = ?').run(n, DICTIONARY_ID)
  count_shared.close()
  console.info(`✓ ensured dev.db test entry e_ja ("water") + sense se_ja; entry_count=${n}`)
} catch (error) {
  console.warn(`⚠ could not seed dev.db test entry (${dev_db_path}): ${error instanceof Error ? error.message : error}`)
}

console.info(`✓ seeded shared.db: "Dev Playground" catalog row + ${DEV_MANAGER_EMAIL} (${MOCK_USER_ID}) as MANAGER of ${DICTIONARY_ID}`)
