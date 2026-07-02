import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'

/**
 * Offline invariants over a migrated data dir — NO Supabase needed. Run after
 * migrate.ts (and again on the VPS copy if paranoid):
 *
 *   tsx supabase-cutover/validate-sqlite.ts [--data-dir DIR] [--exclude river]
 *
 * Checks per dict db:
 *  1. PRAGMA foreign_key_check clean
 *  2. NO positional `lo{n}` orthography-key residue in entries.lexeme /
 *     sentences.text (the get_headword fallback only consults registered codes)
 *  3. NO HTML-era residue in entries.notes (values must be markdown/plain)
 *  4. audio.source / videos.source values all resolve to sources.slug
 *  5. sentences that belong to a text have a sort_key (info-level: legacy
 *     texts sometimes omitted ids from their array — reported, not fatal)
 * And in shared.db:
 *  6. dictionaries.about/grammar free of HTML-era residue
 *  7. entry_count parity vs live entry rows for every migrated dict
 *  8. users.email uniqueness sanity (the UNIQUE constraint enforces it, but a
 *     failed upsert would have thrown mid-run — this confirms end state)
 */

const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DATA_DIR = resolve(here, '../../../site/.data')

function get_flag(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--'))
    return process.argv[index + 1]
  return fallback
}

interface Problem {
  dict_id: string
  check: string
  detail: string
}

function count(db: BetterSqlite3.Database, sql: string): number {
  return (db.prepare(sql).get() as { count: number }).count
}

function main() {
  const data_dir = get_flag('--data-dir', DEFAULT_DATA_DIR)!
  const exclude = new Set((get_flag('--exclude') ?? '').split(',').map(id => id.trim()).filter(Boolean))

  const dict_dir = join(data_dir, 'dictionaries')
  const problems: Problem[] = []
  const infos: Problem[] = []

  const shared = new BetterSqlite3(join(data_dir, 'shared.db'), { readonly: true })
  const catalog_entry_counts = new Map<string, number>(
    (shared.prepare(`SELECT id, entry_count FROM dictionaries`).all() as { id: string, entry_count: number }[])
      .map(row => [row.id, row.entry_count]),
  )

  // shared.db checks
  const html_about = count(shared, `SELECT COUNT(*) AS count FROM dictionaries WHERE TRIM(COALESCE(about, '')) LIKE '<%'`)
  if (html_about)
    problems.push({ dict_id: '_shared', check: 'html-residue', detail: `${html_about} dictionaries.about still HTML` })
  const html_grammar = count(shared, `SELECT COUNT(*) AS count FROM dictionaries WHERE TRIM(COALESCE(grammar, '')) LIKE '<%'`)
  if (html_grammar)
    problems.push({ dict_id: '_shared', check: 'html-residue', detail: `${html_grammar} dictionaries.grammar still HTML` })
  const dupe_emails = shared.prepare(
    `SELECT LOWER(email) AS email, COUNT(*) AS count FROM users WHERE email IS NOT NULL GROUP BY LOWER(email) HAVING COUNT(*) > 1`,
  ).all() as { email: string, count: number }[]
  for (const dupe of dupe_emails)
    problems.push({ dict_id: '_shared', check: 'dupe-email', detail: `${dupe.email} × ${dupe.count}` })

  const files = existsSync(dict_dir)
    ? readdirSync(dict_dir).filter(name => name.endsWith('.db') && !name.includes('.history.') && !name.includes('.bak'))
    : []

  let checked = 0
  for (const file of files) {
    const dict_id = file.replace(/\.db$/, '')
    if (exclude.has(dict_id))
      continue
    const db = new BetterSqlite3(join(dict_dir, file), { readonly: true })
    try {
      const violations = db.pragma('foreign_key_check') as unknown[]
      if (violations.length)
        problems.push({ dict_id, check: 'fk', detail: `${violations.length} violations` })

      const lo_lexeme = count(db, `SELECT COUNT(*) AS count FROM entries WHERE lexeme GLOB '*"lo[0-9]"*'`)
      if (lo_lexeme)
        problems.push({ dict_id, check: 'lo-residue', detail: `${lo_lexeme} entries.lexeme with lo{n} keys` })
      const lo_text = count(db, `SELECT COUNT(*) AS count FROM sentences WHERE text GLOB '*"lo[0-9]"*'`)
      if (lo_text)
        problems.push({ dict_id, check: 'lo-residue', detail: `${lo_text} sentences.text with lo{n} keys` })

      // MultiString values that still start with '<' → unconverted HTML.
      const html_notes = count(db, `SELECT COUNT(*) AS count FROM entries WHERE notes GLOB '*:"<*'`)
      if (html_notes)
        problems.push({ dict_id, check: 'html-residue', detail: `${html_notes} entries.notes still HTML` })

      const bad_audio_sources = count(db, `SELECT COUNT(*) AS count FROM audio WHERE source IS NOT NULL AND source NOT IN (SELECT slug FROM sources)`)
      if (bad_audio_sources)
        problems.push({ dict_id, check: 'audio-source', detail: `${bad_audio_sources} audio.source not a registry slug` })
      const bad_video_sources = count(db, `SELECT COUNT(*) AS count FROM videos WHERE source IS NOT NULL AND source NOT IN (SELECT slug FROM sources)`)
      if (bad_video_sources)
        problems.push({ dict_id, check: 'video-source', detail: `${bad_video_sources} videos.source not a registry slug` })

      const bad_entry_sources = count(db, `
        SELECT COUNT(*) AS count FROM entries, json_each(entries.sources)
        WHERE entries.sources IS NOT NULL AND json_each.value NOT IN (SELECT slug FROM sources)`)
      if (bad_entry_sources)
        problems.push({ dict_id, check: 'entry-source', detail: `${bad_entry_sources} entry source refs not registry slugs` })

      const unsorted = count(db, `SELECT COUNT(*) AS count FROM sentences WHERE text_id IS NOT NULL AND sort_key IS NULL`)
      if (unsorted)
        infos.push({ dict_id, check: 'text-sentence-no-sort-key', detail: `${unsorted} sentences in texts without sort_key` })

      const entries = count(db, `SELECT COUNT(*) AS count FROM entries`)
      const catalog_count = catalog_entry_counts.get(dict_id)
      if (catalog_count !== undefined && catalog_count !== entries)
        problems.push({ dict_id, check: 'entry-count', detail: `catalog says ${catalog_count}, db has ${entries}` })

      checked++
    } finally {
      db.close()
    }
  }
  shared.close()

  for (const info of infos)
    console.info(`ℹ ${info.dict_id} ${info.check}: ${info.detail}`)
  for (const problem of problems)
    console.error(`✗ ${problem.dict_id} ${problem.check}: ${problem.detail}`)
  console.info(`\nvalidated ${checked} dict dbs — ${problems.length === 0 ? '✓ all invariants hold' : `✗ ${problems.length} problems`}${infos.length ? ` (${infos.length} info notes)` : ''}`)
  process.exitCode = problems.length === 0 ? 0 : 1
}

main()
