/**
 * One-off: merge the four typo-variant part-of-speech values in the Ponca
 * dictionary onto the spelling the rest of the data already uses.
 *
 * `past. t.` → `past t.`, `prep phr.` → `prep. phr.`,
 * `3rd pers sing.` → `3rd pers. sing.`, `s./pl.` → `sing./pl.`
 *
 * Each is a single stray sense; every target spelling is already present on
 * other senses, so this is a pure de-duplication of the value vocabulary — no
 * mapping judgement, which is why it is the one part of the POS cleanup Jacob
 * approved for direct apply (`.issues/ponca-grammar-round-2.md`, Lane 3).
 *
 * Writes go through the v1 entry PATCH (`senses[].parts_of_speech` REPLACES),
 * so they are attributed + history-tracked exactly like a human edit.
 *
 * Usage:
 *   node pos-typo-merge.cjs --dry                  # print the plan, touch nothing
 *   node pos-typo-merge.cjs --apply --key=ldk_…    # PATCH prod via /api/v1
 *   node pos-typo-merge.cjs --verify               # read-back: 0 typo values left
 */

const TYPOS = {
  'past. t.': 'past t.',
  'prep phr.': 'prep. phr.',
  '3rd pers sing.': '3rd pers. sing.',
  's./pl.': 'sing./pl.',
}

/** Rewrite one parts_of_speech array; returns null when nothing changes. */
function merge_typos(parts_of_speech) {
  if (!parts_of_speech.some(value => TYPOS[value]))
    return null
  const next = []
  for (const value of parts_of_speech) {
    const mapped = TYPOS[value] ?? value
    if (!next.includes(mapped))
      next.push(mapped)
  }
  return next
}

module.exports = { TYPOS, merge_typos }

// `require.main` is undefined when the script is piped to `node` over stdin,
// which is exactly how it runs against prod (`ssh living 'docker exec -i sveltekit_blue node' < …`).
if (require.main === module || require.main === undefined) {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const verify = args.includes('--verify')
  const key = (args.find(a => a.startsWith('--key=')) || '').slice(6)
  const base = (args.find(a => a.startsWith('--base=')) || '--base=https://livingdictionaries.app').slice(7)
  const db_path = (args.find(a => a.startsWith('--db=')) || '--db=/data/dictionaries/ponca.db').slice(5)

  const db = require('better-sqlite3')(db_path, { readonly: true })
  const rows = db.prepare(`
    SELECT s.id AS sense_id, s.entry_id, s.parts_of_speech, s.glosses, e.lexeme
    FROM senses s JOIN entries e ON e.id = s.entry_id
    WHERE s.parts_of_speech IS NOT NULL AND s.parts_of_speech != '[]'
  `).all()

  const plan = []
  for (const row of rows) {
    const parts_of_speech = JSON.parse(row.parts_of_speech)
    const next = merge_typos(parts_of_speech)
    if (next) plan.push({ ...row, lexeme: JSON.parse(row.lexeme).default, gloss: row.glosses ? JSON.parse(row.glosses) : null, parts_of_speech, next })
  }

  if (verify) {
    console.log(`typo values remaining: ${plan.length}`)
    const counts = new Map()
    for (const row of rows) for (const value of JSON.parse(row.parts_of_speech)) counts.set(value, (counts.get(value) || 0) + 1)
    for (const [from, to] of Object.entries(TYPOS))
      console.log(`  ${JSON.stringify(from)} → ${counts.get(from) || 0} sense(s) · ${JSON.stringify(to)} → ${counts.get(to) || 0} sense(s)`)
    console.log(`distinct POS values now: ${counts.size}`)
    process.exit(plan.length ? 1 : 0)
  }

  console.log(`senses needing a merge: ${plan.length}\n`)
  for (const item of plan)
    console.log(`— ${item.lexeme} (${JSON.stringify(item.gloss)})\n   entry ${item.entry_id} sense ${item.sense_id}\n   ${JSON.stringify(item.parts_of_speech)} → ${JSON.stringify(item.next)}`)

  if (!apply) { console.log('\nDRY RUN — nothing written. Re-run with --apply --key=ldk_…'); process.exit(0) }
  if (!key) { console.error('--apply needs --key=ldk_…'); process.exit(1) }

  ;(async () => {
    let ok = 0
    for (const item of plan) {
      const response = await fetch(`${base}/api/v1/dictionaries/ponca/entries/${item.entry_id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${key}` },
        body: JSON.stringify({ senses: [{ id: item.sense_id, parts_of_speech: item.next }] }),
      })
      if (!response.ok) { console.error(`FAIL ${item.entry_id}: ${response.status} ${(await response.text()).slice(0, 300)}`); continue }
      const body = await response.json()
      const sense = body.entry?.senses?.find(s => s.id === item.sense_id)
      console.log(`ok ${item.lexeme} → ${JSON.stringify(sense?.parts_of_speech)}`)
      ok++
    }
    console.log(`\npatched ${ok}/${plan.length}`)
  })()
}
