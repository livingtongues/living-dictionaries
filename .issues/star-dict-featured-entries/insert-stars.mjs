import Database from 'better-sqlite3'
import fs from 'node:fs'

// Runs INSIDE the VPS container (docker exec -i sveltekit_blue node --input-type=module).
// Reads a combined picks file from stdin: [{ id, name, tier, chosen: [{entry_id, lexeme, gloss}] }]
// Writes featured_entries rows for each dict — best-first order via fractional sort_key.

const JACOB_USER_ID = 'f0fdbb2f-b87d-4717-8858-37e64efeb112'

// --- fractional-index (copied from site/src/lib/api/v1/fractional-index.ts) ---
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'
const [ZERO] = DIGITS
function key_between(lower, upper) {
  if (lower !== null && upper !== null && lower >= upper)
    throw new Error(`fractional-index: lower (${lower}) must sort before upper (${upper})`)
  return midpoint(lower ?? '', upper)
}
function initial_keys(count) {
  const keys = []
  let prev = null
  for (let i = 0; i < count; i++) {
    const key = key_between(prev, null)
    keys.push(key)
    prev = key
  }
  return keys
}
function midpoint(a, b) {
  if (b !== null && a >= b)
    throw new Error(`fractional-index: ${a} >= ${b}`)
  if (b !== null) {
    let n = 0
    while ((a[n] ?? ZERO) === b[n]) n++
    if (n > 0)
      return b.slice(0, n) + midpoint(a.slice(n), b.slice(n))
  }
  const digit_a = a ? DIGITS.indexOf(a[0]) : 0
  const digit_b = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length
  if (digit_b - digit_a > 1)
    return DIGITS[Math.round(0.5 * (digit_a + digit_b))]
  if (b !== null && b.length > 1)
    return b.slice(0, 1)
  return DIGITS[digit_a] + midpoint(a.slice(1), null)
}
// --- end fractional-index ---

// --- minimal inline migration (dictionary-migrations/20260704_featured_entries.sql) ---
const FEATURED_ENTRIES_MIGRATION = `
CREATE TABLE IF NOT EXISTS featured_entries (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  sort_key TEXT NOT NULL,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (entry_id)
);
CREATE INDEX IF NOT EXISTS idx_featured_entries_sort ON featured_entries(sort_key);
CREATE INDEX IF NOT EXISTS idx_featured_entries_updated_at ON featured_entries(updated_at);
CREATE TRIGGER IF NOT EXISTS featured_entries_after_insert_bump_lmod
AFTER INSERT ON featured_entries BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS featured_entries_after_update_bump_lmod
AFTER UPDATE ON featured_entries BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
`
// --- end migration ---

function ensure_featured_entries_table(db) {
  const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='featured_entries'`).get()
  if (!exists) {
    db.pragma('foreign_keys = OFF')
    db.exec(FEATURED_ENTRIES_MIGRATION)
    db.pragma('foreign_keys = ON')
    // Record in the migrations table too, matching run_sql_migrations' bookkeeping,
    // so a later real app-boot doesn't try to re-run (and fail on) this migration.
    const has_migrations_table = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`).get()
    if (has_migrations_table) {
      const already = db.prepare(`SELECT name FROM migrations WHERE name = ?`).get('20260704_featured_entries.sql')
      if (!already) {
        db.prepare('INSERT INTO migrations (id, name, run_on) VALUES (?, ?, ?)').run(
          crypto.randomUUID(), '20260704_featured_entries.sql', new Date().toISOString(),
        )
      }
    }
  }
}

async function main() {
  const input = fs.readFileSync(0, 'utf8')
  const picks = JSON.parse(input) // [{ id, name, tier, chosen: [{entry_id, lexeme, gloss}] }]

  const results = []
  for (const dict of picks) {
    const db_path = `/data/dictionaries/${dict.id}.db`
    if (!fs.existsSync(db_path)) {
      results.push({ id: dict.id, error: 'missing_db' })
      continue
    }
    const db = new Database(db_path)
    try {
      db.pragma('journal_mode = WAL')
      db.pragma('busy_timeout = 5000')
      ensure_featured_entries_table(db)

      const existing_count = db.prepare(`SELECT COUNT(*) c FROM featured_entries`).get().c
      const keys = initial_keys(dict.chosen.length)
      const now = new Date().toISOString()
      const insert = db.prepare(`
        INSERT INTO featured_entries (id, entry_id, sort_key, created_at, created_by_user_id, updated_at, updated_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(entry_id) DO NOTHING
      `)
      let inserted = 0
      db.exec('BEGIN')
      try {
        dict.chosen.forEach((c, i) => {
          const info = insert.run(crypto.randomUUID(), c.entry_id, keys[i], now, JACOB_USER_ID, now, JACOB_USER_ID)
          if (info.changes > 0) inserted++
        })
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
      results.push({ id: dict.id, name: dict.name, requested: dict.chosen.length, inserted, existing_before: existing_count })
    } catch (err) {
      results.push({ id: dict.id, error: String(err) })
    } finally {
      db.close()
    }
  }
  console.log(JSON.stringify(results, null, 2))
}

main()
