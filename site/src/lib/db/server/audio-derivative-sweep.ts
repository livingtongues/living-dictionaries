import Database from 'better-sqlite3'
import { store_audio_derivative_in_background } from '$lib/server/audio-derivative'
import { audio_playback_key } from '$lib/utils/media-path'
import { dictionary_db_path } from './dictionary-db'
import { get_shared_db } from './shared-db'

const CAP_PER_RUN = 40

export function run_audio_derivative_sweep(): void {
  const shared = get_shared_db()
  // Derive the sibling in JS and use indexed key lookups.
  const cutoff = new Date(Date.now() - 60_000).toISOString()
  const recent = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const rows = shared.prepare(`
    SELECT original.key, original.dict_id
    FROM media_objects original
    LEFT JOIN media_objects derivative
      ON derivative.key = substr(original.key, 1, instr(original.key, '/audio/') + 42) || '_p1.mp3'
    WHERE original.media_type = 'audio' AND original.is_variant = 0
      AND original.uploaded_at < ?
      AND (derivative.key IS NULL OR original.uploaded_at >= ?)
    ORDER BY derivative.key IS NULL DESC, original.uploaded_at
    LIMIT ?
  `).all(cutoff, recent, CAP_PER_RUN * 4) as { key: string, dict_id: string }[]
  let queued = 0
  for (const row of rows) {
    if (queued >= CAP_PER_RUN) break
    const derivative_key = audio_playback_key({ original_key: row.key })
    const derivative = shared.prepare(`SELECT uploaded_at FROM media_objects WHERE key = ?`).get(derivative_key) as { uploaded_at: string } | undefined
    let audio: { sentence_id: string | null, text_id: string | null, timings: string | null, updated_at: string } | undefined
    try {
      const db = new Database(dictionary_db_path(row.dict_id), { readonly: true, fileMustExist: true })
      try {
        audio = db.prepare(`SELECT sentence_id, text_id, timings, updated_at FROM audio WHERE storage_path = ?`).get(row.key) as typeof audio
      } finally { db.close() }
    } catch { continue }
    if (!audio) continue
    const must_be_untrimmed = Boolean(audio.sentence_id || audio.text_id || audio.timings)
    const needs_generation = !derivative || (must_be_untrimmed && derivative.uploaded_at < audio.updated_at)
    if (needs_generation && store_audio_derivative_in_background({ original_key: row.key, trim: !must_be_untrimmed }))
      queued++
  }
}
