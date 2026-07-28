/**
 * One-off: de-SHOUT the Ponca grammar. The PDF source used ALL CAPS for chapter
 * titles, table headers and some glosses; Jacob asked for Title Case titles and
 * normal-case body labels ("not screaming at us").
 *
 * Vernacular is NEVER touched — `Ą́`, `Đi-`, `Wá-` etc. keep their own
 * capitalization. That is why the body pass is an explicit whitelist of English
 * strings rather than a "looks like caps" regex: a naive regex eats `Ą́`
 * (12 occurrences) and every other capitalized Ponca form.
 *
 * Usage:
 *   node decaps-grammar.cjs --dry            # print the diff, touch nothing
 *   node decaps-grammar.cjs --apply --key=ldk_…   # PATCH prod via /api/v1
 */

const TITLES = {
  'PRONUNCIATION GUIDE': 'Pronunciation Guide',
  'PARTS OF SPEECH': 'Parts of Speech',
  'THE PONCA VERB': 'The Ponca Verb',
  'VERB CLASSES': 'Verb Classes',
  'BASIC VERB PARADIGMS IN PONCA': 'Basic Verb Paradigms in Ponca',
  'VERBS WITH FIRST PERSON Ą- ‘I’ AND SECOND PERSON ĐI-‘YOU’': 'Verbs with First Person Ą- ‘I’ and Second Person Đi- ‘you’',
  'VERBS WITH SECOND PERSON Š- ‘YOU’': 'Verbs with Second Person Š- ‘you’',
  'VERBS WITH FIRST PERSON B- AND SECOND PERSON NA-': 'Verbs with First Person B- and Second Person Na-',
  'VERBS WITH BOTH SUBJECT AND OBJECT MARKERS': 'Verbs with Both Subject and Object Markers',
  'VERB PREFIXES': 'Verb Prefixes',
  'VERBAL SUFFIXES': 'Verbal Suffixes',
  'TENSE MARKING IN THE PONCA LANGUAGE: PAST, PRESENT, AND FUTURE': 'Tense Marking in the Ponca Language: Past, Present, and Future',
  'VERB INTERNAL MODIFIERS': 'Verb Internal Modifiers',
  'PONCA ARTICLES AND CLASSES OF OBJECTS': 'Ponca Articles and Classes of Objects',
  'DEMONSTRATIVE PRONOUNS': 'Demonstrative Pronouns',
  'INTERJECTIONS': 'Interjections',
  'POSSESSIVE PREFIXES': 'Possessive Prefixes',
  'RELATIONSHIPS BETWEEN OMAHA AND PONCA': 'Relationships Between Omaha and Ponca',
  'PONCA NUMERICAL SYSTEM': 'Ponca Numerical System',
  // Data fix spotted in the same pass: this is the SECOND person paradigm.
  'Second person singular subject (“I”)—Đihą́ ‘to lift’': 'Second person singular subject (“you”)—Đihą́ ‘to lift’',
}

// Longest first so "FOR WANT OF" wins over "OF", "HE/SHE/IT" over "IT".
const BODY = [
  ['NATURE OF DIFFERENCE', 'Nature of difference'],
  ['FOR WANT OF, WANTING TO', 'for want of, wanting to'],
  ['ARABIC NUMERAL', 'Arabic numeral'],
  ['FUTURE PERFECT', 'future perfect'],
  ['PAST PERFECT', 'past perfect'],
  ['HIM/HER/IT', 'him/her/it'],
  ['HE/SHE/IT', 'he/she/it'],
  ['PONCA WORD', 'Ponca word'],
  ['1ST PERSON', '1st person'],
  ['2ND PERSON', '2nd person'],
  ['3RD PERSON', '3rd person'],
  ['NEGATION', 'negation'],
  ['SINGULAR', 'Singular'],
  ['TOO, ALSO', 'too, also'],
  ['ENGLISH', 'English'],
  ['PLURAL', 'Plural'],
  ['CAUSE', 'cause'],
  ['OMAHA', 'Omaha'],
  ['PONCA', 'Ponca'],
  ['THEM', 'them'],
  ['THEY', 'they'],
  ['DUAL', 'dual'],
  ['YOU', 'you'],
  ['NOT', 'not'],
  ['WE', 'we'],
]

// The import left MIXED unicode normalization in the data — some titles carry a
// precomposed `ą` (U+0105), others `a` + U+0328 — so a title must be looked up
// NFC-folded or the match silently misses.
const TITLES_BY_NFC = new Map(Object.entries(TITLES).map(([from, to]) => [from.normalize('NFC'), to]))

function lookup_title(text) {
  return TITLES_BY_NFC.get(text.normalize('NFC')) ?? text
}

function escape_regex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whole-token replacement only — never inside a longer word. */
function decaps_body(text) {
  let out = text
  for (const [from, to] of BODY)
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{M}])${escape_regex(from)}(?![\\p{L}\\p{M}])`, 'gu'), to)
  return out
}

function map_multistring(value, mapper) {
  if (!value) return null
  let changed = false
  const next = {}
  for (const [locale, text] of Object.entries(value)) {
    const mapped = typeof text === 'string' ? mapper(text) : text
    if (mapped !== text) changed = true
    next[locale] = mapped
  }
  return changed ? next : null
}

module.exports = { TITLES, BODY, decaps_body, map_multistring, lookup_title }

if (require.main === module) {
  const args = process.argv.slice(2)
  const dry = !args.includes('--apply')
  const key = (args.find(a => a.startsWith('--key=')) || '').slice(6)
  const base = (args.find(a => a.startsWith('--base=')) || '--base=https://livingdictionaries.app').slice(7)
  const db_path = (args.find(a => a.startsWith('--db=')) || '--db=/data/dictionaries/ponca.db').slice(5)

  const db = require('better-sqlite3')(db_path, { readonly: true })
  const rows = db.prepare('SELECT id, title, body FROM grammar_sections').all()

  const patches = []
  for (const row of rows) {
    const title = row.title ? JSON.parse(row.title) : null
    const body = row.body ? JSON.parse(row.body) : null
    const patch = {}
    const next_title = map_multistring(title, lookup_title)
    if (next_title) patch.title = next_title
    const next_body = map_multistring(body, decaps_body)
    if (next_body) patch.body = next_body
    if (Object.keys(patch).length) patches.push({ id: row.id, title, body, patch })
  }

  console.log(`sections needing changes: ${patches.length} / ${rows.length}\n`)
  for (const { id, title, patch } of patches) {
    console.log(`— ${id.slice(0, 8)}`)
    if (patch.title) {
      for (const [locale, text] of Object.entries(patch.title))
        if (text !== title?.[locale]) console.log(`   title  ${JSON.stringify(title?.[locale])}\n       →  ${JSON.stringify(text)}`)
    }
    if (patch.body) console.log(`   body   (${Object.keys(patch.body).length} locale(s) rewritten)`)
  }

  if (dry) { console.log('\nDRY RUN — nothing written. Re-run with --apply --key=ldk_…'); process.exit(0) }
  if (!key) { console.error('--apply needs --key=ldk_…'); process.exit(1) }

  ;(async () => {
    let ok = 0
    for (const { id, patch } of patches) {
      const response = await fetch(`${base}/api/v1/dictionaries/ponca/grammar/sections/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${key}` },
        body: JSON.stringify(patch),
      })
      if (!response.ok) { console.error(`FAIL ${id}: ${response.status} ${(await response.text()).slice(0, 200)}`); continue }
      ok++
    }
    console.log(`patched ${ok}/${patches.length}`)
  })()
}
