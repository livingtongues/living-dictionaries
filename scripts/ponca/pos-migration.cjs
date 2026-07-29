/**
 * One-off: apply the approved Ponca part-of-speech standardization
 * (`.issues/ponca-pos-report.md`, Lane 5 of `.issues/ponca-grammar-round-2.md`).
 *
 * Four write groups, all through the v1 API so they are attributed +
 * history-tracked exactly like a human edit:
 *
 *   1. POS-only remaps (report 2a) — the book's phrase abbreviations written out
 *      in full, since the printed key table is being dropped.
 *   2. Person / number / tense pseudo-POS → `entries.morphology` Leipzig codes
 *      (report 3), leaving only the real POS on the sense.
 *   3. Two legend rows (report 3b) — `1` (used by Wamą́ʼ) and `2` (symmetry with `3`).
 *   4. The "Parts of Speech" grammar section body (report part 4) — intro prose
 *      kept, 37-row abbreviation table replaced by the 10 usage labels the data
 *      actually uses.
 *
 * Usage:
 *   node pos-migration.cjs --dry                  # print the plan, touch nothing
 *   node pos-migration.cjs --dry --json           # machine-readable plan (cross-check vs the report)
 *   node pos-migration.cjs --apply --key=ldk_…    # PATCH prod via /api/v1
 *   node pos-migration.cjs --verify               # read-back: 0 pseudo-POS left, morphology filled
 */

/** POS value → replacement POS values (report 2a/2b). Order is preserved. */
const POS_REMAP = {
  'prep. phr.': ['prepositional phrase'],
  'pron. phr.': ['pronoun phrase'],
  'n./prep. phr.': ['n', 'prepositional phrase'],
  'adv. suffix': ['adv', 'suff'],
  // a missing space, not a category: the sense also carries `past part.`
  'v. past t.': ['v'],
  'pl. pron.': ['pro'],
  // wíwítʼa "they are mine" is a possessive pronoun, not a verb (report 2b)
  'pl./emphatic': ['poss'],
}

/** POS value → morphology code it becomes (report 3b). Removed from the POS array. */
const MORPHOLOGY_CODE = {
  '1st pers. sing.': '1SG',
  '2nd pers. sing.': '2SG',
  '3rd pers. sing.': '3SG',
  '1st pers. pl.': '1PL',
  '2nd pers. pl.': '2PL',
  '3rd pers. pl.': '3PL',
  '1st pers.': '1',
  '3rd pers.': '3',
  '3rd pers. sing./pl.': '3SG/3PL',
  'sing.': 'SG',
  'pl': 'PL',
  'sing./pl.': 'SG/PL',
  'past t.': 'PST',
  'pres. t.': 'PRS',
  'pres./past t.': 'PRS/PST',
  'past part.': 'PST.PTCP',
  // these two also remap the POS above
  'pl. pron.': 'PL',
  'pl./emphatic': 'PL.EMPH',
  'v. past t.': 'PST',
}

/** Codes that describe person/number — they lead the composed string (report 3c: `1PL.PST`). */
const PERSON_NUMBER = new Set(['1SG', '2SG', '3SG', '1PL', '2PL', '3PL', '1', '2', '3', '3SG/3PL', 'SG', 'PL', 'SG/PL', 'PL.EMPH'])

/**
 * Senses whose POS array would be empty once the pseudo-POS moves out
 * (report 3e). Jacob's calls: Áʼbitʼà → `v` (its sibling sense is `["v"]`),
 * Wéšną → `adj` (Ponca marks stative concepts adjectivally).
 */
const EMPTY_POS_DEFAULT = {
  '88808443-d898-573c-b30e-4142f6081ee9': { lexeme: 'Áʼbitʼà', parts_of_speech: ['v'] },
  'a0709f2c-0da4-5f14-9231-bd906e75e619': { lexeme: 'Wéšną', parts_of_speech: ['adj'] },
}

const LEGEND_ADDITIONS = [
  { code: '1', name: { default: 'first person' }, category: 'person and number' },
  { code: '2', name: { default: 'second person' }, category: 'person and number' },
]

const POS_SECTION_ID = '5bffc336-c31a-5070-8013-ae8b3f96abcc'

const POS_SECTION_BODY = `Every entry in the Ponca to English section of this dictionary begins with at least one sample Ponca word, along with an English translation and an indication of the **part of speech** in Ponca. Note that the verb is at the heart of the language and many other parts of speech derive from verbs, including many nouns and adjectives.

Parts of speech are written out in full on each entry, so the printed book's abbreviation key is no longer needed here. Person, number and tense — which the book also printed in the part-of-speech slot — now appear as glossing codes in an entry's **morphology** field; the glossing abbreviations at the end of this grammar expand every code.

A handful of abbreviations still appear inside the definitions themselves:

|   |   |
| --- | --- |
| abbr. | abbreviated |
| archaic | no longer in ordinary use |
| e.g. | for example |
| esp. | especially |
| fem. | form used by, or of, a woman |
| lit. | literally |
| masc. | form used by, or of, a man |
| orig. | originally |
| slang | slang |
| usu. | usually |`

/**
 * Compose the morphology string: person/number codes first, then tense/aspect,
 * joined by `.` — `1PL.PST`, `3SG.PRS/PST`.
 *
 * A tense code that another present code already contains is dropped, so
 * Ađį́ áti (`v. past t.` + `past part.` → PST + PST.PTCP) reads `PST.PTCP`
 * rather than `PST.PST.PTCP`. This is the only sense that hits the rule.
 */
function compose_morphology(codes) {
  const unique = [...new Set(codes)]
  const kept = unique.filter(code => !unique.some(other => other !== code && other.split('.').includes(code)))
  const person = kept.filter(code => PERSON_NUMBER.has(code))
  const tense = kept.filter(code => !PERSON_NUMBER.has(code))
  return [...person, ...tense].join('.')
}

/**
 * Rewrite one sense's POS array → `{ parts_of_speech, codes }`, or null when
 * the sense needs no change.
 */
function migrate_sense({ parts_of_speech, sense_id }) {
  if (!parts_of_speech.some(value => POS_REMAP[value] || MORPHOLOGY_CODE[value]))
    return null
  const next = []
  const codes = []
  for (const value of parts_of_speech) {
    for (const replacement of POS_REMAP[value] ?? (MORPHOLOGY_CODE[value] ? [] : [value])) {
      if (!next.includes(replacement))
        next.push(replacement)
    }
    if (MORPHOLOGY_CODE[value])
      codes.push(MORPHOLOGY_CODE[value])
  }
  if (!next.length) {
    const fallback = EMPTY_POS_DEFAULT[sense_id]
    if (!fallback)
      throw new Error(`sense ${sense_id} would be left with no part of speech and has no approved default`)
    next.push(...fallback.parts_of_speech)
  }
  return { parts_of_speech: next, morphology: compose_morphology(codes) }
}

module.exports = { POS_REMAP, MORPHOLOGY_CODE, compose_morphology, migrate_sense }

// `require.main` is undefined when the script is piped to `node` over stdin,
// which is exactly how it runs against prod (`ssh living 'docker exec -i sveltekit_blue node' < …`).
if (require.main === module || require.main === undefined) {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const verify = args.includes('--verify')
  const as_json = args.includes('--json')
  const key = (args.find(a => a.startsWith('--key=')) || '').slice(6)
  const base = (args.find(a => a.startsWith('--base=')) || '--base=https://livingdictionaries.app').slice(7)
  const db_path = (args.find(a => a.startsWith('--db=')) || '--db=/data/dictionaries/ponca.db').slice(5)

  const db = require('better-sqlite3')(db_path, { readonly: true })
  const sense_rows = db.prepare(`
    SELECT s.id AS sense_id, s.entry_id, s.parts_of_speech, s.glosses, e.lexeme, e.morphology
    FROM senses s JOIN entries e ON e.id = s.entry_id
    WHERE s.parts_of_speech IS NOT NULL AND s.parts_of_speech != '[]'
  `).all()

  /** entry_id → { lexeme, morphology, senses: [{ sense_id, before, after }] } */
  const by_entry = new Map()
  for (const row of sense_rows) {
    const parts_of_speech = JSON.parse(row.parts_of_speech)
    const result = migrate_sense({ parts_of_speech, sense_id: row.sense_id })
    if (!result)
      continue
    const lexeme = JSON.parse(row.lexeme).default
    const gloss = row.glosses ? Object.values(JSON.parse(row.glosses))[0] : null
    const item = by_entry.get(row.entry_id) ?? { entry_id: row.entry_id, lexeme, existing_morphology: row.morphology, morphology: '', senses: [] }
    item.senses.push({ sense_id: row.sense_id, gloss, before: parts_of_speech, after: result.parts_of_speech, morphology: result.morphology })
    if (result.morphology) {
      if (item.morphology && item.morphology !== result.morphology)
        throw new Error(`entry ${row.entry_id} (${lexeme}) has disagreeing sense morphology: ${item.morphology} vs ${result.morphology}`)
      item.morphology = result.morphology
    }
    by_entry.set(row.entry_id, item)
  }
  const plan = [...by_entry.values()]
  const touched_senses = plan.reduce((total, item) => total + item.senses.length, 0)
  const morphology_senses = plan.reduce((total, item) => total + item.senses.filter(s => s.morphology).length, 0)

  if (verify) {
    const counts = new Map()
    for (const row of sense_rows) for (const value of JSON.parse(row.parts_of_speech)) counts.set(value, (counts.get(value) || 0) + 1)
    const stale = [...Object.keys(POS_REMAP), ...Object.keys(MORPHOLOGY_CODE)].filter(value => counts.get(value))
    console.log(`senses still needing migration: ${touched_senses}`)
    console.log(`stale POS values remaining: ${stale.length ? stale.map(v => `${JSON.stringify(v)}×${counts.get(v)}`).join(', ') : 'none'}`)
    console.log(`distinct POS values now: ${counts.size}`)
    const filled = db.prepare(`SELECT COUNT(*) c FROM entries WHERE morphology IS NOT NULL AND morphology != ''`).get().c
    console.log(`entries carrying morphology: ${filled}`)
    const distribution = db.prepare(`SELECT morphology, COUNT(*) c FROM entries WHERE morphology IS NOT NULL AND morphology != '' GROUP BY morphology ORDER BY c DESC`).all()
    console.log(distribution.map(r => `  ${r.morphology} × ${r.c}`).join('\n'))
    const written_out = ['prepositional phrase', 'pronoun phrase', 'suff', 'pro', 'poss', 'adj']
    console.log(`written-out / remapped POS counts: ${written_out.map(v => `${v}=${counts.get(v) || 0}`).join(' · ')}`)
    const legend = db.prepare(`SELECT code, name, category FROM glossing_abbreviations WHERE code IN ('1','2')`).all()
    console.log(`legend additions present: ${JSON.stringify(legend)}`)
    const section = db.prepare(`SELECT body FROM grammar_sections WHERE id = ?`).get(POS_SECTION_ID)
    const body = JSON.parse(section.body).default
    console.log(`POS section body: ${body.length} chars · table rows ${(body.match(/^\| /gm) || []).length} · legacy key dropped: ${!body.includes('past part.')}`)
    process.exit(touched_senses ? 1 : 0)
  }

  if (as_json) {
    console.log(JSON.stringify(plan, null, 2))
    process.exit(0)
  }

  console.log(`entries to patch: ${plan.length} · senses touched: ${touched_senses} (of which ${morphology_senses} yield morphology)\n`)
  for (const item of plan) {
    console.log(`— ${item.lexeme} (entry ${item.entry_id})${item.morphology ? `  morphology → ${item.morphology}` : ''}`)
    for (const sense of item.senses)
      console.log(`   ${JSON.stringify(sense.gloss)}  ${JSON.stringify(sense.before)} → ${JSON.stringify(sense.after)}`)
  }
  console.log(`\nlegend additions: ${LEGEND_ADDITIONS.map(l => l.code).join(', ')}`)
  console.log(`grammar section ${POS_SECTION_ID} body → ${POS_SECTION_BODY.length} chars`)

  if (!apply) { console.log('\nDRY RUN — nothing written. Re-run with --apply --key=ldk_…'); process.exit(0) }
  if (!key) { console.error('--apply needs --key=ldk_…'); process.exit(1) }

  ;(async () => {
    const headers = { 'content-type': 'application/json', 'authorization': `Bearer ${key}` }
    let ok = 0
    const failures = []
    for (const item of plan) {
      const body = { senses: item.senses.map(s => ({ id: s.sense_id, parts_of_speech: s.after })) }
      if (item.morphology)
        body.morphology = item.morphology
      const response = await fetch(`${base}/api/v1/dictionaries/ponca/entries/${item.entry_id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
      if (!response.ok) {
        failures.push(`${item.lexeme} ${item.entry_id}: ${response.status} ${(await response.text()).slice(0, 300)}`)
        continue
      }
      const result = await response.json()
      const entry = result.entry
      const senses_after = item.senses.map(s => JSON.stringify(entry?.senses?.find(x => x.id === s.sense_id)?.parts_of_speech)).join(' ')
      // entry-level fields come back nested under `main`, not on the entry itself
      console.log(`ok ${item.lexeme} · morphology ${JSON.stringify(entry?.main?.morphology ?? null)} · ${senses_after}`)
      ok++
    }
    console.log(`\npatched ${ok}/${plan.length} entries`)
    for (const failure of failures) console.error(`FAIL ${failure}`)

    for (const legend of LEGEND_ADDITIONS) {
      const response = await fetch(`${base}/api/v1/dictionaries/ponca/grammar/glossing-abbreviations`, { method: 'POST', headers, body: JSON.stringify(legend) })
      console.log(`legend ${legend.code}: ${response.status} ${(await response.text()).slice(0, 200)}`)
    }

    const section_response = await fetch(`${base}/api/v1/dictionaries/ponca/grammar/sections/${POS_SECTION_ID}`, { method: 'PATCH', headers, body: JSON.stringify({ body: { default: POS_SECTION_BODY } }) })
    console.log(`section: ${section_response.status} ${(await section_response.text()).slice(0, 200)}`)
  })()
}
