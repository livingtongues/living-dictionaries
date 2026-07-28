// One-off DATA repair: flatten Ponca's redundant grammar root.
//
// The PDF import wrapped all 19 chapters under a single top-level section titled
// "Notes on Ponca Pronunciation and Grammar" — which duplicates the page's own
// "Grammar" heading and buried every chapter at depth 1 (numbers 1.1 … 1.19).
// The grammar PAGE is the root; the chapters belong at the top level.
//
// What this does, in ONE transaction:
//   1. Promotes every direct child of the root to `parent_id = NULL`. Their
//      existing sibling `sort_key`s (i, r, w, y, z, zi, …) already sort in the
//      right order at any level, so they carry over untouched.
//   2. Keeps the root row — it holds a 1455-char preface worth preserving — but
//      clears its `title` (redundant) and moves its `sort_key` to '9'
//      (= key_between(null, 'i'), the app's fractional-index midpoint) so it
//      stays first. Untitled + childless, the page now renders it as an
//      unnumbered preface above chapter 1.
//
// `updated_at` is bumped on every touched row so the R2 snapshot builder picks
// them up; `dirty` is NEVER set — that flag is client-only.
//
// Dry-run by default. Preview, then apply:
//   ssh living 'docker exec -i sveltekit_blue node' < scripts/one-off/2026-07-28-ponca-flatten-grammar-root.cjs
//   ssh living 'docker exec -i -e APPLY=1 sveltekit_blue node' < scripts/one-off/2026-07-28-ponca-flatten-grammar-root.cjs
//
// Back up the dict.db first:
//   ssh living 'sudo cp /opt/hosting/data/dictionaries/ponca.db /opt/hosting/data/dictionaries/ponca.db.bak-$(date -u +%Y%m%d-%H%M%S)'
//
// Locally: DATA_DIR=site/.data node scripts/one-off/2026-07-28-ponca-flatten-grammar-root.cjs

const { existsSync } = require('node:fs')
const Database = require('better-sqlite3')

const DICT_ID = 'ponca'
// key_between(null, 'i') from $lib/api/v1/fractional-index — sorts before every
// existing chapter key without rewriting any of them.
const PREFACE_SORT_KEY = '9'

const data_dir = process.env.DATA_DIR || '/data'
const apply = process.env.APPLY === '1'
const path = `${data_dir}/dictionaries/${DICT_ID}.db`

if (!existsSync(path)) {
  console.error(`no dictionary db at ${path}`)
  process.exit(1)
}

const db = new Database(path, { readonly: !apply })

function title_of(row) {
  try {
    const parsed = JSON.parse(row.title || '{}')
    return Object.values(parsed).find(value => value?.trim()) || '(untitled)'
  }
  catch {
    return '(unparseable title)'
  }
}

const roots = db.prepare('SELECT * FROM grammar_sections WHERE parent_id IS NULL').all()
if (roots.length !== 1) {
  console.error(`expected exactly ONE top-level section, found ${roots.length} — nothing to flatten, aborting`)
  process.exit(1)
}

const [root] = roots
const children = db.prepare('SELECT * FROM grammar_sections WHERE parent_id = ? ORDER BY sort_key').all(root.id)

console.log(`\ndictionary: ${DICT_ID}   total sections: ${db.prepare('SELECT COUNT(*) c FROM grammar_sections').get().c}`)
console.log(`root: ${root.id}  "${title_of(root)}"  sort_key=${root.sort_key}  body=${(root.body || '').length} chars\n`)
console.log('action              | id                                   | detail')
console.log('--------------------|--------------------------------------|--------------------------------')
console.log(`clear title         | ${root.id} | "${title_of(root)}" -> null`)
console.log(`resort preface      | ${root.id} | sort_key ${root.sort_key} -> ${PREFACE_SORT_KEY}`)
for (const child of children)
  console.log(`promote to top      | ${child.id} | ${child.sort_key.padEnd(5)} ${title_of(child)}`)

console.log(`\n${children.length} chapters promoted, 1 root demoted to an unnumbered preface.`)

if (!apply) {
  console.log('\nDRY RUN — re-run with APPLY=1 to write.\n')
  process.exit(0)
}

const now = new Date().toISOString()
const promote = db.prepare('UPDATE grammar_sections SET parent_id = NULL, updated_at = ? WHERE id = ?')
const demote = db.prepare('UPDATE grammar_sections SET title = NULL, sort_key = ?, updated_at = ? WHERE id = ?')

db.transaction(() => {
  for (const child of children)
    promote.run(now, child.id)
  demote.run(PREFACE_SORT_KEY, now, root.id)
})()

const after = db.prepare('SELECT id, sort_key, title FROM grammar_sections WHERE parent_id IS NULL ORDER BY sort_key').all()
console.log(`\nAFTER — ${after.length} top-level sections:`)
for (const row of after)
  console.log(`  ${row.sort_key.padEnd(5)} ${title_of(row)}`)

console.log(`\nintegrity_check: ${db.pragma('integrity_check', { simple: true })}`)
console.log('Reaches browsers on the next R2 snapshot rebuild (~30 min).\n')
