// One-off: migrate the legacy `dictionaries.grammar` blob (a single markdown
// string in shared.db) INTO each dictionary's per-dict `dictionaries/<id>.db` as
// a headless (title-less), body-only first `grammar_sections` row — the new home
// for the structured, parallel-language grammar. See .issues/structured-grammar.md.
//
// One BIG section per dict (deterministic + lossless). The blob is stored under
// the dictionary's FIRST gloss language (verified against prod: the prose
// language == gloss_languages[0] for all 170 dicts with grammar). Prettifying the
// longer ones into proper section trees is a later, per-dict reviewed pass.
//
// Idempotent: the section id is uuid5(dict_id) under a fixed namespace, so a
// re-run skips dicts already imported. Cross-DB (reads shared.db, writes each
// dict.db), so it can't ride the .sql migration lane — this is the one-shot.
//
// After each insert the dict.db AFTER-INSERT triggers assign `server_seq` + bump
// `db_metadata.last_modified_at` (so admin/editor clients pull it on next sync),
// and we bump shared.db `dictionaries.updated_at` so the R2 snapshot builder
// (`WHERE updated_at > COALESCE(snapshot_uploaded_at, '1970')`) rebuilds the
// snapshot → cold/new clients get the section too.
//
// PREREQUISITE: run AFTER the deploy that ships 20260714_structured_grammar.sql,
// so `grammar_sections` exists in every dict.db (a dict.db missing the table is
// reported + skipped, never corrupted).
//
// Run inside the app container (better-sqlite3 + /data mount):
//   ssh living 'docker exec -i sveltekit_blue node' < scripts/one-off/2026-07-14-grammar-blob-to-sections.cjs
// Back up shared.db first:
//   ssh living 'sudo cp /opt/hosting/data/shared.db /opt/hosting/data/shared.db.bak-$(date -u +%Y%m%d-%H%M%S)'
// Pass DRY=1 to preview without writing.
//
// Locally: DATA_DIR=site/.data node scripts/one-off/2026-07-14-grammar-blob-to-sections.cjs

const { existsSync } = require('node:fs')
const crypto = require('node:crypto')
const Database = require('better-sqlite3')

// Fixed namespace so section ids are stable + reproducible across runs/machines.
const NAMESPACE = '6b3f0d2c-9a41-4e58-b7c6-1d2e3f4a5b60'
// Stamped as the section's author. dict.db has no users table (no FK), so any
// stable marker works; this labels the row as a system migration.
const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000000'
// = initial_keys(1)[0] from $lib/api/v1/fractional-index — the sole top-level
// section, so app-created siblings sort cleanly around it later.
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
const dry = process.env.DRY === '1'
const now = new Date().toISOString()

const shared = new Database(`${data_dir}/shared.db`, { readonly: dry })

const dicts = shared.prepare(
  `SELECT id, gloss_languages, grammar FROM dictionaries
   WHERE grammar IS NOT NULL AND TRIM(grammar) != ''`,
).all()

console.log(`Found ${dicts.length} dictionaries with a grammar blob`)

const bump_snapshot = dry ? null : shared.prepare(`UPDATE dictionaries SET updated_at = ? WHERE id = ?`)

let created = 0
let skipped = 0
let no_file = 0
let no_table = 0
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
    const has_table = dict.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'grammar_sections'`).get()
    if (!has_table) {
      no_table++
      console.warn(`SKIP ${id}: grammar_sections table missing (deploy the migration first)`)
      continue
    }
    if (dict.prepare(`SELECT 1 FROM grammar_sections WHERE id = ?`).get(section_id)) {
      skipped++
      continue
    }
    if (dry) {
      console.log(`DRY create ${id} → section under '${lang}' (${grammar.length} chars)`)
      created++
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
  + (no_file ? ` · ${no_file} without a local dict.db` : '')
  + (no_table ? ` · ${no_table} missing the table` : '')
  + (errors ? ` · ${errors} errors` : ''),
)
