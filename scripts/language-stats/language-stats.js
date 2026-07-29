// Per-language data-scale CSV (built 2026-07-29 for the World Bank Low-Resource
// Language Index request; re-runnable any time). Runs INSIDE the app container:
//   ssh living 'docker exec -i sveltekit_blue node' < language-stats.js > language-stats.csv
//
// One row per glottocode across PUBLIC dictionaries (multi-dict languages merged,
// `dictionaries` column counts them), plus one aggregate bottom row for the
// unlisted tier (those communities opted out of the public listing, so they are
// never itemized). Definitions:
// - total_entries: headword entries (dictionary lexical entries)
// - total_words: whitespace-tokenized target-language word tokens across
//   headwords + example/text-corpus sentences (first orthography per row, so
//   parallel orthographies of the same word aren't double-counted)
// - entries_with_audio: entries having >= 1 audio recording
// - audio_hours / video_hours: summed probed/declared media durations from the
//   media_objects ledger (see the 20260729 migration + backfill)
const fs = require('fs')
const Database = require('better-sqlite3')

const shared = new Database('/data/shared.db', { readonly: true })
const dicts = shared.prepare(`
  SELECT id, name, glottocode, iso_639_3, public, bucket FROM dictionaries
  WHERE public = 1 OR bucket = 'unlisted'
`).all()

// Durations come from the ledger's 20260729 duration_ms column; before that
// migration/backfill has landed, fall back to a probe JSONL shipped to
// /data/media-metadata.jsonl (see ../media-metadata-backfill/).
const has_durations = shared.prepare(`SELECT 1 FROM pragma_table_info('media_objects') WHERE name = 'duration_ms'`).get()
const durations = new Map(!has_durations
  ? []
  : shared.prepare(`
    SELECT dict_id, media_type, SUM(duration_ms) AS duration_ms
    FROM media_objects WHERE is_variant = 0 GROUP BY dict_id, media_type
  `).all().map(row => [`${row.dict_id}/${row.media_type}`, row.duration_ms ?? 0]))
if (![...durations.values()].some(value => value > 0) && fs.existsSync('/data/media-metadata.jsonl')) {
  const media_key = /^([^/]+)\/(audio|video)\//
  for (const line of fs.readFileSync('/data/media-metadata.jsonl', 'utf8').split('\n')) {
    if (!line.trim())
      continue
    const record = JSON.parse(line)
    const match = record.key.match(media_key)
    if (!match || !record.duration_ms)
      continue
    const map_key = `${match[1]}/${match[2]}`
    durations.set(map_key, (durations.get(map_key) ?? 0) + record.duration_ms)
  }
}

function count_tokens(multistring_json) {
  if (!multistring_json)
    return 0
  let parsed
  try {
    parsed = JSON.parse(multistring_json)
  } catch {
    return 0
  }
  const first_value = Object.values(parsed ?? {}).find(value => typeof value === 'string' && value.trim())
  if (!first_value)
    return 0
  return first_value.trim().split(/\s+/).length
}

function dict_stats(dict_id) {
  const path = `/data/dictionaries/${dict_id}.db`
  if (!fs.existsSync(path))
    return null
  const db = new Database(path, { readonly: true })
  try {
    const entries = db.prepare('SELECT COUNT(*) AS count FROM entries').get().count
    const entries_with_audio = db.prepare('SELECT COUNT(DISTINCT entry_id) AS count FROM audio WHERE entry_id IS NOT NULL').get().count
    let words = 0
    for (const row of db.prepare('SELECT lexeme FROM entries').all())
      words += count_tokens(row.lexeme)
    for (const row of db.prepare('SELECT text FROM sentences').all())
      words += count_tokens(row.text)
    return { entries, entries_with_audio, words }
  } finally {
    db.close()
  }
}

const HOUR_MS = 3_600_000
const by_glottocode = new Map()
const unlisted = { dictionaries: 0, entries: 0, audio_ms: 0, video_ms: 0 }

for (const dict of dicts) {
  const stats = dict_stats(dict.id)
  if (!stats)
    continue
  const audio_ms = durations.get(`${dict.id}/audio`) ?? 0
  const video_ms = durations.get(`${dict.id}/video`) ?? 0
  if (dict.public !== 1) {
    unlisted.dictionaries++
    unlisted.entries += stats.entries
    unlisted.audio_ms += audio_ms
    unlisted.video_ms += video_ms
    continue
  }
  const glottocode = dict.glottocode?.trim() || `no-glottocode:${dict.id}`
  if (!by_glottocode.has(glottocode))
    by_glottocode.set(glottocode, { names: [], isos: new Set(), dictionaries: 0, entries: 0, words: 0, entries_with_audio: 0, audio_ms: 0, video_ms: 0 })
  const language = by_glottocode.get(glottocode)
  language.names.push(dict.name)
  if (dict.iso_639_3?.trim() && dict.iso_639_3 !== 'n/a')
    language.isos.add(dict.iso_639_3.trim())
  language.dictionaries++
  language.entries += stats.entries
  language.words += stats.words
  language.entries_with_audio += stats.entries_with_audio
  language.audio_ms += audio_ms
  language.video_ms += video_ms
}

const csv_escape = value => /[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value)
const hours = ms => (ms / HOUR_MS).toFixed(2)
const lines = ['language,glottocode,iso_639_3,dictionaries,total_entries,total_words,entries_with_audio,audio_hours,video_hours']
const sorted = [...by_glottocode.entries()].sort((a, b) => b[1].entries - a[1].entries)
for (const [glottocode, language] of sorted) {
  lines.push([
    csv_escape([...new Set(language.names)].join(' / ')),
    glottocode.startsWith('no-glottocode:') ? '' : glottocode,
    [...language.isos].join(' / '),
    language.dictionaries,
    language.entries,
    language.words,
    language.entries_with_audio,
    hours(language.audio_ms),
    hours(language.video_ms),
  ].join(','))
}
lines.push([
  csv_escape('(unlisted tier — additional dictionaries not itemized at the communities\' choice)'),
  '', '',
  unlisted.dictionaries,
  unlisted.entries,
  '', '',
  hours(unlisted.audio_ms),
  hours(unlisted.video_ms),
].join(','))
console.log(lines.join('\n'))
