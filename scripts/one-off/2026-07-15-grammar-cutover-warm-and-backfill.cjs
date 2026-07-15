// CUTOVER one-off (supersedes 2026-07-14-grammar-blob-to-sections.cjs):
// WARM every blob-dict's per-dict `dictionaries/<id>.db` up to the latest schema
// (many prod dicts weren't opened since the 2026-07-14 deploy, so they still lack
// the `grammar_sections` table — the plain backfill would skip them), THEN migrate
// the legacy `dictionaries.grammar` blob (shared.db) INTO each dict.db as a headless
// (title-less), body-only first `grammar_sections` row. See .issues/structured-grammar.md.
//
// Why a second script: the committed 2026-07-14 backfill SKIPS a dict whose dict.db
// lacks the table. Prod audit (2026-07-15): 106 of 170 blob-dicts were un-migrated
// (99 two behind @ 20260709, 7 one behind @ 20260713). This script applies the
// missing `.sql` migrations FIRST (a faithful replay of $lib/db/server/run-sql-migrations.ts
// — same BEGIN/COMMIT, FKs off, `migrations` bookkeeping), so all 170 get their section.
//
// One BIG section per dict (deterministic + lossless): the blob is stored under the
// dict's FIRST gloss language (verified against prod). Prettifying the longer ones
// into proper section trees is a later, per-dict reviewed pass.
//
// Idempotent: section id = uuid5(dict_id) under a fixed namespace (re-run skips
// already-imported dicts); migrations skip already-applied ones. After each insert
// the dict.db AFTER-INSERT triggers assign `server_seq` + bump `db_metadata.last_modified_at`
// (admin/editor clients pull it), and we bump shared.db `dictionaries.updated_at` so the
// R2 snapshot builder rebuilds the snapshot → cold/new clients get the section too.
//
// Run inside the app container (better-sqlite3 + /data mount). Copy the migration
// `.sql` files in first (the built container doesn't ship the source tree):
//   ssh living 'sudo cp /opt/hosting/data/shared.db /opt/hosting/data/shared.db.bak-'"$(date -u +%Y%m%d-%H%M%S)"
//   docker cp site/src/lib/db/schemas/dictionary-migrations sveltekit_blue:/tmp/dict-migrations
//   ssh living 'docker exec -i -e MIGRATIONS_DIR=/tmp/dict-migrations sveltekit_blue node' < scripts/one-off/2026-07-15-grammar-cutover-warm-and-backfill.cjs
// Pass DRY=1 to preview without writing (opens read-only; reports would-migrate / would-create).
//
// Locally: MIGRATIONS_DIR=site/src/lib/db/schemas/dictionary-migrations DATA_DIR=site/.data \
//   node scripts/one-off/2026-07-15-grammar-cutover-warm-and-backfill.cjs

const { existsSync, readdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const crypto = require('node:crypto')
const Database = require('better-sqlite3')

// Fixed namespace so section ids are stable + reproducible across runs/machines
// (SAME as the 2026-07-14 script, so the two never double-insert).
const NAMESPACE = '6b3f0d2c-9a41-4e58-b7c6-1d2e3f4a5b60'
const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000000'
// = initial_keys(1)[0] from $lib/api/v1/fractional-index — the sole top-level section.
const INTRO_SORT_KEY = 'i'

/** RFC-4122 uuid v5 (SHA-1, namespaced) — deterministic id from the dict id. */
function uuid5(name, namespace) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex')
  const hash = crypto.createHash('sha1').update(ns).update(name, 'utf8').digest()
  const bytes = hash.subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0F) | 0x50 // version 5
  bytes[8] = (bytes[8] & 0x3F) | 0x80 // variant
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const data_dir = process.env.DATA_DIR || '/data'
const migrations_dir = process.env.MIGRATIONS_DIR || '/tmp/dict-migrations'
const dry = process.env.DRY === '1'
const now = new Date().toISOString()

// Load migration `.sql` files (sorted by name) — mirrors the eager glob import.
const migration_files = readdirSync(migrations_dir)
  .filter(name => name.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b))
  .map(name => ({ name, sql: readFileSync(join(migrations_dir, name), 'utf8') }))
if (!migration_files.length) {
  console.error(`No .sql migrations found in ${migrations_dir} — set MIGRATIONS_DIR.`)
  process.exit(1)
}
console.log(`Loaded ${migration_files.length} migration(s) from ${migrations_dir}: ${migration_files.map(m => m.name).join(', ')}`)

/** Faithful replay of run_sql_migrations() — applies un-applied migrations in order. Returns count applied. */
function apply_migrations(db) {
  const has_migrations_table = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'`).get()
  let applied = new Set()
  if (has_migrations_table)
    applied = new Set(db.prepare('SELECT name FROM migrations').all().map(row => row.name))

  let count = 0
  for (const { name, sql } of migration_files) {
    if (applied.has(name))
      continue
    db.pragma('foreign_keys = OFF')
    try {
      db.exec(`BEGIN; ${sql}; COMMIT;`)
    } catch (err) {
      try { db.exec('ROLLBACK') } catch { /* already rolled back */ }
      db.pragma('foreign_keys = ON')
      throw err
    }
    db.pragma('foreign_keys = ON')
    const table_exists = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'`).get()
    if (table_exists)
      db.prepare('INSERT INTO migrations (id, name, run_on) VALUES (?, ?, ?)').run(crypto.randomUUID(), name, new Date().toISOString())
    count++
  }
  return count
}

/** Which migrations a (dry) dict.db is still missing — read-only. */
function pending_migrations(db) {
  const has_migrations_table = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'`).get()
  const applied = has_migrations_table
    ? new Set(db.prepare('SELECT name FROM migrations').all().map(row => row.name))
    : new Set()
  return migration_files.filter(m => !applied.has(m.name)).map(m => m.name)
}

const shared = new Database(`${data_dir}/shared.db`, { readonly: dry })

const dicts = shared.prepare(
  `SELECT id, gloss_languages, grammar FROM dictionaries
   WHERE grammar IS NOT NULL AND TRIM(grammar) != ''`,
).all()

console.log(`Found ${dicts.length} dictionaries with a grammar blob`)

const bump_snapshot = dry ? null : shared.prepare(`UPDATE dictionaries SET updated_at = ? WHERE id = ?`)

let created = 0
let skipped = 0
let migrated_dicts = 0
let migrations_applied = 0
let no_file = 0
let errors = 0

for (const { id, gloss_languages, grammar } of dicts) {
  const gloss = gloss_languages ? JSON.parse(gloss_languages) : []
  const lang = gloss[0] || 'en'
  const section_id = uuid5(id, NAMESPACE)
  const dict_path = `${data_dir}/dictionaries/${id}.db`

  if (!existsSync(dict_path)) {
    no_file++
    console.warn(`SKIP ${id}: no local dict.db (only an R2 snapshot?) — handle separately`)
    continue
  }

  let dict
  try {
    dict = new Database(dict_path, { readonly: dry })
    dict.pragma('busy_timeout = 5000')

    if (dry) {
      const pending = pending_migrations(dict)
      const already = !!dict.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'grammar_sections'`).get()
        && !!dict.prepare(`SELECT 1 FROM grammar_sections WHERE id = ?`).get(section_id)
      console.log(`DRY ${id}: ${pending.length ? `migrate [${pending.join(', ')}]` : 'schema current'}; ${already ? 'section already present' : `would create section under '${lang}' (${grammar.length} chars)`}`)
      if (pending.length) { migrated_dicts++; migrations_applied += pending.length }
      if (!already) created++
      else skipped++
      continue
    }

    const applied = apply_migrations(dict)
    if (applied) { migrated_dicts++; migrations_applied += applied }

    if (dict.prepare(`SELECT 1 FROM grammar_sections WHERE id = ?`).get(section_id)) {
      skipped++
      continue
    }
    dict.prepare(
      `INSERT INTO grammar_sections (id, parent_id, sort_key, title, body, created_by_user_id, created_at, updated_by_user_id, updated_at)
       VALUES (?, NULL, ?, NULL, ?, ?, ?, ?, ?)`,
    ).run(section_id, INTRO_SORT_KEY, JSON.stringify({ [lang]: grammar }), SYSTEM_USER_ID, now, SYSTEM_USER_ID, now)
    bump_snapshot.run(now, id)
    created++
  } catch (err) {
    errors++
    console.error(`ERROR ${id}: ${err.message}`)
  } finally {
    if (dict) dict.close()
  }
}

console.log(
  `\n${dry ? '[dry run] would create' : 'created'} ${created} sections`
  + ` · ${skipped} already present`
  + ` · ${dry ? 'would migrate' : 'migrated'} ${migrated_dicts} dict.db (${migrations_applied} migration runs)`
  + (no_file ? ` · ${no_file} without a local dict.db` : '')
  + (errors ? ` · ${errors} errors` : ''),
)
