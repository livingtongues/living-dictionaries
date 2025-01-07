import fs from 'node:fs'
import type { ImportContentUpdate } from '@living-dictionaries/types/supabase/content-import.interface'
import { jacob_ld_user_id } from '../config-supabase'
import { sql_file_string } from './to-sql-string'

const content_update_file = fs.createWriteStream(`./logs/${Date.now()}_content-updates.json`, { flags: 'w' }) // 'a' to append, 'w' to truncate the file every time the process starts.
content_update_file.write('[\n')

const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
let milliseconds_to_add = 0

function millisecond_incrementing_timestamp(): string {
  milliseconds_to_add += 1
  return new Date(yesterday.getTime() + milliseconds_to_add).toISOString()
}

export function prepare_sql(body: ImportContentUpdate) {
  console.info(body)

  let sql_statements = ''

  const { update_id, dictionary_id, import_id, type, data } = body

  const created_at = data?.created_at || millisecond_incrementing_timestamp()
  // @ts-expect-error
  const updated_at = data?.updated_at || created_at

  // @ts-expect-error
  const created_by = data?.created_by || jacob_ld_user_id
  // @ts-expect-error
  const updated_by = data?.updated_by || created_by

  const c_u_meta = {
    created_by,
    updated_by,
    created_at,
    updated_at,
  }

  const c_meta = {
    created_by,
    created_at,
  }

  if (type === 'insert_entry') {
    const sql = sql_file_string('entries', {
      ...data,
      ...c_u_meta,
      dictionary_id,
      id: body.entry_id,
    }, 'UPSERT')
    sql_statements += `\n${sql}`
  }

  if (type === 'insert_sense') {
    const sql = sql_file_string('senses', {
      ...data,
      ...c_u_meta,
      entry_id: body.entry_id,
      id: body.sense_id,
    })
    sql_statements += `\n${sql}`
  }

  if (type === 'insert_dialect') {
    const sql = sql_file_string('dialects', {
      ...data,
      ...c_u_meta,
      dictionary_id,
      id: body.dialect_id,
    })
    sql_statements += `\n${sql}`
  }

  if (type === 'assign_dialect') {
    const sql = sql_file_string('entry_dialects', {
      ...c_meta,
      dialect_id: body.dialect_id,
      entry_id: body.entry_id,
    })
    sql_statements += `\n${sql}`
  }

  if (type === 'upsert_speaker') {
    const sql = sql_file_string('speakers', {
      ...data,
      ...c_u_meta,
      dictionary_id,
      id: body.speaker_id,
    })
    sql_statements += `\n${sql}`
  }

  if (type === 'assign_speaker' && body.audio_id) {
    const sql = sql_file_string('audio_speakers', {
      ...c_meta,
      speaker_id: body.speaker_id,
      audio_id: body.audio_id,
    })
    sql_statements += `\n${sql}`
  }

  if (type === 'assign_speaker' && body.video_id) {
    const sql = sql_file_string('video_speakers', {
      ...c_meta,
      speaker_id: body.speaker_id,
      video_id: body.video_id,
    })
    sql_statements += `\n${sql}`
  }

  if (type === 'insert_sentence') {
    const sql = sql_file_string('sentences', {
      ...data,
      ...c_u_meta,
      dictionary_id,
      id: body.sentence_id,
    })
    sql_statements += `\n${sql}`

    const sql2 = sql_file_string('senses_in_sentences', {
      ...c_meta,
      sentence_id: body.sentence_id,
      sense_id: body.sense_id,
    })
    sql_statements += `\n${sql2}`
  }

  if (type === 'upsert_audio') {
    const sql = sql_file_string('audio', {
      ...data,
      ...c_u_meta,
      dictionary_id,
      id: body.audio_id,
      entry_id: body.entry_id,
    })
    sql_statements += `\n${sql}`
  }

  if (type === 'insert_photo') {
    const sql = sql_file_string('photos', {
      ...data,
      ...c_u_meta,
      dictionary_id,
      id: body.photo_id,
    })
    sql_statements += `\n${sql}`

    const sql2 = sql_file_string('sense_photos', {
      ...c_meta,
      photo_id: body.photo_id,
      sense_id: body.sense_id,
    })
    sql_statements += `\n${sql2}`
  }

  if (type === 'insert_video') {
    const sql = sql_file_string('videos', {
      ...data,
      ...c_u_meta,
      dictionary_id,
      id: body.video_id,
    })
    sql_statements += `\n${sql}`

    const sql2 = sql_file_string('sense_videos', {
      ...c_meta,
      video_id: body.video_id,
      sense_id: body.sense_id,
    })
    sql_statements += `\n${sql2}`
  }

  const data_without_ids = { ...data }
  delete data_without_ids.id
  delete data_without_ids.dictionary_id
  delete data_without_ids.entry_id
  delete data_without_ids.sense_id
  delete data_without_ids.created_at
  delete data_without_ids.created_by
  delete data_without_ids.updated_at
  delete data_without_ids.updated_by

  const content_update = {
    id: update_id,
    user_id: updated_by,
    dictionary_id,
    timestamp: updated_at,
    import_id,
    type,
    data: Object.keys(data_without_ids)?.length ? data_without_ids : null,
    // @ts-expect-error - avoiding verbosity but requires manual type checking
    ...(body.audio_id && { audio_id: body.audio_id }),
    // @ts-expect-error
    ...(body.dialect_id && { dialect_id: body.dialect_id }),
    // @ts-expect-error
    ...(body.entry_id && { entry_id: body.entry_id }),
    // @ts-expect-error
    ...(body.photo_id && { photo_id: body.photo_id }),
    // @ts-expect-error
    ...(body.sense_id && { sense_id: body.sense_id }),
    // @ts-expect-error
    ...(body.sentence_id && { sentence_id: body.sentence_id }),
    // @ts-expect-error
    ...(body.speaker_id && { speaker_id: body.speaker_id }),
    // @ts-expect-error
    ...(body.text_id && { text_id: body.text_id }),
    // @ts-expect-error
    ...(body.video_id && { video_id: body.video_id }),
    // This is the properly typed version but much more verbose as requires one for each change type
    // ...(type === 'insert_sense' && { sense_id: body.sense_id, entry_id: body.entry_id }),
  }
  content_update_file.write(`${JSON.stringify(content_update)},\n`)

  return sql_statements
}
