import Database from 'better-sqlite3'
import fs from 'node:fs'

// Runs INSIDE the VPS container (docker exec -i sveltekit_blue node --input-type=module).
// Reads final row list from stdin: array of enriched editor_star candidates (see
// selected-final.json in .issues/star-dict-featured-entries/).
// Inserts into shared.db featured_entries as source='editor_star', status='suggested'.

const AGENT_NOTE = 'editor star swept 2026-07-04'

async function main() {
  const input = fs.readFileSync(0, 'utf8')
  const rows = JSON.parse(input)

  const db = new Database('/data/shared.db')
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')

  const insert = db.prepare(`
    INSERT OR IGNORE INTO featured_entries
      (id, dict_id, entry_id, sense_id, photo_id, audio_id, lexeme, gloss, gloss_language,
       photo_serving_url, audio_storage_path, dict_name, longitude, latitude, status, agent_note,
       source, phonetic, glosses, speaker_name, example_sentence, starred_at, created_at, updated_at)
    VALUES
      (@id, @dict_id, @entry_id, @sense_id, @photo_id, @audio_id, @lexeme, @gloss, @gloss_language,
       @photo_serving_url, @audio_storage_path, @dict_name, @longitude, @latitude, 'suggested', @agent_note,
       'editor_star', @phonetic, @glosses, @speaker_name, @example_sentence, @starred_at, @now, @now)
  `)

  const now = new Date().toISOString()
  let inserted = 0
  let skipped_duplicate = 0
  const errors = []

  db.exec('BEGIN')
  try {
    for (const r of rows) {
      try {
        const info = insert.run({
          id: crypto.randomUUID(),
          dict_id: r.dict_id,
          entry_id: r.entry_id,
          sense_id: r.sense_id ?? null,
          photo_id: r.photo_id ?? null,
          audio_id: r.audio_id ?? null,
          lexeme: r.lexeme,
          gloss: r.gloss ?? null,
          gloss_language: r.gloss_language ?? null,
          photo_serving_url: r.photo_serving_url,
          audio_storage_path: r.audio_storage_path,
          dict_name: r.dict_name,
          longitude: r.longitude ?? null,
          latitude: r.latitude ?? null,
          agent_note: AGENT_NOTE,
          phonetic: r.phonetic ?? null,
          glosses: r.glosses ? JSON.stringify(r.glosses) : null,
          speaker_name: r.speaker_name ?? null,
          example_sentence: r.example_sentence ? (typeof r.example_sentence === 'string' ? r.example_sentence : JSON.stringify(r.example_sentence)) : null,
          starred_at: r.starred_at ?? null,
          now,
        })
        if (info.changes > 0) inserted++
        else skipped_duplicate++
      } catch (err) {
        errors.push({ dict_id: r.dict_id, entry_id: r.entry_id, error: String(err) })
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  console.log(JSON.stringify({ requested: rows.length, inserted, skipped_duplicate, errors }, null, 2))
  db.close()
}

main()
