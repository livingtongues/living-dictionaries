// One-off (2026-07-29): remove the 313 header-only WAV recordings found by the
// duration backfill — each is exactly 44 bytes: `RIFF`/`WAVE` with a declared
// `data` chunk size of 0, i.e. provably zero audio samples. They render as
// broken/silent players in the UI, so better nothing than a broken something.
//
// Deletion is a tombstone (`INSERT INTO deletes`) per the dict.db convention:
// `process_delete_cascade` hard-DELETEs the audio row and FK-cascades
// `audio_speakers`, and the tombstone bumps `last_modified_at` so peers + the
// snapshot builder drop it too. The R2 objects are deliberately NOT deleted
// here — once no live row references them the weekly media sweep marks them
// orphaned and really deletes them after the 30-day grace (backup mirror keeps
// a copy for a year).
//
//   ssh living 'docker exec -i sveltekit_blue node' < delete-empty-audio.js              # dry run
//   ssh living 'docker exec -i -e APPLY=1 sveltekit_blue node' < delete-empty-audio.js   # write
const fs = require('fs')
const Database = require('better-sqlite3')

const keys = JSON.parse(fs.readFileSync('/data/zero-keys.json', 'utf8'))
const by_dict = {}
for (const key of keys) {
  const dict_id = key.split('/')[0]
  ;(by_dict[dict_id] ??= []).push(key)
}

const apply = process.env.APPLY === '1'
let planned = 0
const plan = []

for (const [dict_id, dict_keys] of Object.entries(by_dict)) {
  const path = `/data/dictionaries/${dict_id}.db`
  if (!fs.existsSync(path)) {
    plan.push({ dict_id, error: 'dict db missing' })
    continue
  }
  const db = new Database(path)
  const placeholders = dict_keys.map(() => '?').join(',')
  const rows = db.prepare(`SELECT id, storage_path FROM audio WHERE storage_path IN (${placeholders})`).all(...dict_keys)
  const audio_before = db.prepare('SELECT COUNT(*) c FROM audio').get().c

  if (apply && rows.length) {
    const tombstone = db.prepare(`INSERT OR IGNORE INTO deletes (table_name, id) VALUES ('audio', ?)`)
    db.pragma('foreign_keys = ON')
    db.transaction(() => {
      for (const row of rows)
        tombstone.run(row.id)
    })()
  }

  const audio_after = db.prepare('SELECT COUNT(*) c FROM audio').get().c
  const orphan_speaker_links = db.prepare(`SELECT COUNT(*) c FROM audio_speakers WHERE audio_id NOT IN (SELECT id FROM audio)`).get().c
  plan.push({ dict_id, empty_keys: dict_keys.length, audio_rows_matched: rows.length, audio_before, audio_after, orphan_speaker_links })
  planned += rows.length
  db.close()
}

console.log(JSON.stringify(plan, null, 1))
console.log(apply
  ? `APPLIED — ${planned} empty audio rows tombstoned across ${plan.length} dictionaries`
  : `DRY RUN — would tombstone ${planned} empty audio rows across ${plan.length} dictionaries (set APPLY=1 to write)`)
