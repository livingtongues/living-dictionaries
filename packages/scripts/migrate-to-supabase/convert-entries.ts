// import { randomUUID } from 'node:crypto'
import type { ActualDatabaseEntry } from '@living-dictionaries/types'
import type { TablesInsert } from '../../site/src/lib/supabase/generated.types'
import entries from './entries.json'

let id_count = 0
function randomUUID() {
  id_count++
  return `use-crypto-uuid-in-real-thing_${id_count}`
}

export function convert_entries() {
  const success = []
  const todo = []
  for (const entry of entries) {
    const [processed_fb_entry_remains, supa_data] = convert_entry(JSON.parse(JSON.stringify(entry)))
    if (Object.keys(processed_fb_entry_remains).length === 0) {
      success.push({ entry, supa_data })
    } else {
      todo.push({ fb_entry: processed_fb_entry_remains, supa_data })
    }
  }
  return { success, todo }
}

function convert_entry(_entry: Partial<ActualDatabaseEntry> & Record<string, any>) {
  const entry: Partial<TablesInsert<'entries'>> = {
    id: _entry.id,
    dictionary_id: _entry.dictionary_id,
  }

  const first_sense_from_base: TablesInsert<'senses'> = {
    entry_id: _entry.id,
    updated_by: _entry.updatedBy,
    created_by: _entry.createdBy,
    id: randomUUID(),
  }

  for (const [key, value] of Object.entries(_entry) as [keyof ActualDatabaseEntry, any][]) {
    const no_value = !value || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && !Object.keys(_entry.sf).length)

    if (no_value) {
      delete _entry[key]
      continue
    }

    if (typeof value === 'string') {
      if (key === 'ph') {
        entry.phonetic = value
        delete _entry[key]
      }
    }

    if (key === 'ps') {
      if (typeof value === 'string')
        first_sense_from_base.parts_of_speech = [value]
      else if (Array.isArray(value))
        first_sense_from_base.parts_of_speech = value
      delete _entry[key]
      continue
    }
  }

  if (typeof _entry.updatedAt?.seconds === 'number') {
    entry.updated_at = new Date(_entry.updatedAt.seconds * 1000).toISOString()
    delete _entry.updatedAt
  }
  if (typeof _entry.ua?.seconds === 'number') {
    entry.updated_at = new Date(_entry.ua.seconds * 1000).toISOString()
    delete _entry.ua
  }
  if (typeof _entry.updatedBy === 'string') {
    entry.updated_by = _entry.updatedBy
    delete _entry.updatedBy
  }
  if (typeof _entry.ub === 'string') {
    entry.updated_by = _entry.ub
    delete _entry.ub
  }
  if (typeof _entry.createdAt?.seconds === 'number') {
    entry.created_at = new Date(_entry.createdAt.seconds * 1000).toISOString()
    delete _entry.createdAt
  }
  if (typeof _entry.createdBy === 'string') {
    entry.created_by = _entry.createdBy
    delete _entry.createdBy
  }

  if (typeof _entry.lx === 'string') {
    entry.lexeme = { default: _entry.lx }
    delete _entry.lx
  }

  if (typeof _entry.nt === 'string') {
    entry.notes = { default: _entry.nt }
    delete _entry.nt
  }

  if (typeof _entry.gl === 'object') {
    first_sense_from_base.glosses = _entry.gl
    delete _entry.gl
  }

  const senses: TablesInsert<'senses'>[] = [first_sense_from_base]
  const audios: TablesInsert<'audio'>[] = []
  const audio_speakers: TablesInsert<'audio_speakers'>[] = []

  if (_entry.sf) {
    const audio_id = randomUUID()
    // TODO: use speakerName
    // eslint-disable-next-line unused-imports/no-unused-vars
    const { ab, path, ts, cr, sp, speakerName } = _entry.sf
    delete _entry.sf.mt
    if (!ab)
      throw new Error(`No ab for ${_entry.id} sf`)
    const audio: TablesInsert<'audio'> = {
      id: audio_id,
      created_by: ab,
      updated_by: ab,
      storage_path: path,
    }
    delete _entry.sf.ab
    delete _entry.sf.path
    if (ts) {
      if (ts.toString().length === 13)
        audio.created_at = new Date(ts).toISOString()
      else
        throw new Error(`odd timestamp for ${_entry.id}: ${ts}`)
      delete _entry.sf.ts
    }
    if (cr) {
      audio.source = cr
      delete _entry.sf.cr
    }
    audios.push(audio)
    if (sp) {
      audio_speakers.push({
        created_by: ab,
        created_at: new Date(ts).toISOString(),
        speaker_id: sp,
        audio_id,
      })
      delete _entry.sf.sp
    }
    if (!Object.keys(_entry.sf).length)
      delete _entry.sf
  }

  const sentences: TablesInsert<'sentences'>[] = []
  const photos: TablesInsert<'photos'>[] = []
  const videos: TablesInsert<'videos'>[] = []

  delete _entry.id
  delete _entry.dictionary_id
  delete _entry.dictId

  return [_entry, { entry, senses, sentences, audios, audio_speakers, photos, videos }]
}
