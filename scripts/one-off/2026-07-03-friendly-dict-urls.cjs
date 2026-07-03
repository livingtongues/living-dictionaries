// One-off: give the 30 dicts with non-ASCII or Firebase-id url slugs a friendly
// ASCII `url` (+ fix ter-saami's trailing CRLF). Ids are untouched — the
// resolver falls back to id so old links keep working, and the [dictionaryId]
// layout 301s them to the new canonical url.
//
// Run inside the app container (better-sqlite3 + /data mount):
//   ssh living 'docker exec -i sveltekit_blue node' < scripts/one-off/2026-07-03-friendly-dict-urls.cjs
// Back up shared.db first:
//   ssh living 'sudo cp /opt/hosting/data/shared.db /opt/hosting/data/shared.db.bak-$(date -u +%Y%m%d-%H%M%S)'
// Pass --dry via env DRY=1 to preview.
//
// Context/decisions: .issues/friendly-dict-urls.md (slugs approved by Jacob 2026-07-03;
// conflicts resolved as aonekko / yoruba-2 / kiikaonde-2 / santali-2).

const db = require('better-sqlite3')(process.env.DATA_DIR ? `${process.env.DATA_DIR}/shared.db` : '/data/shared.db')
const dry = process.env.DRY === '1'

const new_urls = {
  'chabacano-caviteño': 'chabacano-caviteno',
  'denesųłiné-łuwechok-tu': 'denesuline-luwechok-tu',
  'ḍaichyian': 'daichyian',
  'emberá-chamí-catalán': 'embera-chami-catalan',
  'hánačtina': 'hanactina',
  'hñotho': 'hnotho',
  'kmeeṭian': 'kmeetian',
  'laivesòt': 'laivesot',
  'nağaybäk': 'nagaybak',
  'official-yesañ-language': 'official-yesan-language',
  'siebenbürger-saxon': 'siebenburger-saxon',
  'tiłhini': 'tilhini',
  'tudaga-ã': 'tudaga-a',
  'yorùbá': 'yoruba-2',
  'yésah-language': 'yesah-language',
  'zapoteco-de-juárez': 'zapoteco-de-juarez',
  'zazakî': 'zazaki',
  'àfìn': 'afin',
  'дунганский': 'dungan',
  'অসমীয়া': 'asomiya',
  'ḩurīian': 'huriian',
  'jaRhn6MAZim4Blvr1iEv': 'bahasa-lani',
  '80CcDQ4DRyiYSPIWZ9Hy': 'aonekko',
  'AplqDbn7vzVZhGiiYKmJ': 'runa-shimita',
  'zAY0vL2NF3waKYyJEUcS': 'kiikaonde-2',
  'QAThAUaCXUaJVLwZeXEz': 'anihshininiimowin',
  'TzgbJBjSo1Pn2GLMsG61': 'assamese',
  'cH3fbL7uNro07sJMWqry': 'santali-2',
  'ykK8VDgz1H2Fbh2LWRgM': 'itsekiri',
  '6SD8EMju4w312NXb3Y6a': 'jiwere',
  'tér-saami': 'ter-saami', // url was "ter-saami\r\n" (trailing CRLF data bug)
}

const SLUG_PATTERN = /^[a-z0-9-]+$/
const get_dict = db.prepare('SELECT id, url, name FROM dictionaries WHERE id = ?')
const slug_taken = db.prepare('SELECT id FROM dictionaries WHERE (url = ? OR id = ?) AND id != ?')
// dirty = 1 + updated_at bump so admin clients pull the change on next sync
const update_url = db.prepare(`UPDATE dictionaries SET url = ?, updated_at = ?, dirty = 1 WHERE id = ?`)

// DB ids may be NFC or NFD normalized — match on NFC-normalized form, then
// UPDATE by the exact stored id bytes.
const all_ids = db.prepare('SELECT id FROM dictionaries').all().map(row => row.id)
const stored_id_by_nfc = new Map(all_ids.map(id => [id.normalize('NFC'), id]))

let updated = 0
let skipped = 0
const apply = db.transaction(() => {
  for (const [script_id, slug] of Object.entries(new_urls)) {
    if (!SLUG_PATTERN.test(slug)) throw new Error(`invalid slug ${slug}`)
    const id = stored_id_by_nfc.get(script_id.normalize('NFC')) ?? script_id
    const dict = get_dict.get(id)
    if (!dict) {
      console.log(`SKIP (no such dict here): ${id}`)
      skipped++
      continue
    }
    if (dict.url === slug) {
      console.log(`SKIP (already set): ${id} → ${slug}`)
      skipped++
      continue
    }
    const conflict = slug_taken.get(slug, slug, id)
    if (conflict) throw new Error(`slug ${slug} already taken by ${conflict.id}`)
    console.log(`${dry ? 'DRY ' : ''}UPDATE ${id} (${dict.name}): url ${JSON.stringify(dict.url)} → ${slug}`)
    if (!dry) update_url.run(slug, new Date().toISOString(), id)
    updated++
  }
})
apply()

console.log(`\n${dry ? '[dry run] would update' : 'updated'} ${updated}, skipped ${skipped}, of ${Object.keys(new_urls).length}`)
