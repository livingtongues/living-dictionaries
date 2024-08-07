// import { randomUUID } from 'node:crypto'
import type { ActualDatabaseEntry } from '@living-dictionaries/types'
import type { TablesInsert } from '../../site/src/lib/supabase/generated.types'

let id_count = 0
function randomUUID() {
  id_count++
  return `use-crypto-uuid-in-real-thing_${id_count}`
}

const admin_uid_if_no_owner = 'de2d3715-6337-45a3-a81a-d82c3210b2a7' // jacob@livingtongues.org

export function convert_entries(entries: typeof import('./entries.json')) {
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
  try {
    const entry: Partial<TablesInsert<'entries'>> = {
      id: _entry.id,
      dictionary_id: _entry.dictionary_id,
    }

    if (typeof _entry.updatedAt?.seconds === 'number') {
      entry.updated_at = seconds_to_timestamp_string(_entry.updatedAt.seconds)
      delete _entry.updatedAt
    }
    if (typeof _entry.ua?.seconds === 'number') {
      entry.updated_at = seconds_to_timestamp_string(_entry.ua.seconds)
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
      entry.created_at = seconds_to_timestamp_string(_entry.createdAt.seconds)
      delete _entry.createdAt
    }
    if (typeof _entry.createdBy === 'string') {
      entry.created_by = _entry.createdBy
      delete _entry.createdBy
    }
    if (typeof _entry.ab === 'string') {
      if (!entry.created_by)
        entry.created_by = _entry.ab
      delete _entry.ab
    }

    const first_sense_from_base: TablesInsert<'senses'> = {
      entry_id: _entry.id,
      updated_by: entry.updated_by,
      created_by: entry.created_by,
      id: randomUUID(),
    }

    for (const [key, value] of Object.entries(_entry) as [keyof ActualDatabaseEntry, any][]) {
      if (!value || isEmptyArray(value) || isEmptyObject(value)) {
        delete _entry[key]
        continue
      }

      if (typeof value === 'string') {
        if (key === 'ph') {
          entry.phonetic = value
          delete _entry[key]
          continue
        }

        if (key === 'de') {
          first_sense_from_base.definition = {
            en: value,
          }
          delete _entry[key]
          continue
        }

        if (key === 'lx') {
          entry.lexeme = { default: value }
          delete _entry[key]
          continue
        }

        if (key === 'nt') {
          entry.notes = { default: value }
          delete _entry[key]
          continue
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

      if (key === 'sd') {
        if (Array.isArray(value))
          first_sense_from_base.write_in_semantic_domains = value
        delete _entry[key]
        continue
      }
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
      const { ab, path, ts, cr, sp, speakerName } = _entry.sf
      delete _entry.sf.mt
      if (!ab && !entry.created_by)
        console.info(`No ab for ${_entry.id} sf`)
      const audio: TablesInsert<'audio'> = {
        id: audio_id,
        created_by: ab || entry.created_by || admin_uid_if_no_owner,
        updated_by: ab || entry.created_by || admin_uid_if_no_owner,
        storage_path: path,
      }
      delete _entry.sf.ab
      delete _entry.sf.path
      if (ts) {
        if (ts.toString().length === 13)
          audio.created_at = new Date(ts).toISOString()
        // @ts-expect-error
        else if (typeof ts === 'object' && '_seconds' in ts)
          // @ts-expect-error
          audio.created_at = seconds_to_timestamp_string(ts._seconds)
        else
          throw new Error(`odd timestamp for ${_entry.id}: ${ts}`)
        delete _entry.sf.ts
      }
      if (cr) {
        if (cr !== 'Jacob Bowdoin')
          audio.source = cr
        else
          console.info(`Jacob Bowdoin cr for ${_entry.id}, dict:${entry.dictionary_id}`)
        delete _entry.sf.cr
      }
      audios.push(audio)
      if (sp) {
        audio_speakers.push({
          audio_id,
          speaker_id: sp,
          created_by: ab || entry.created_by || admin_uid_if_no_owner,
          created_at: new Date(ts).toISOString(),
        })
        delete _entry.sf.sp
      }
      if (!Object.keys(_entry.sf).length)
        delete _entry.sf
    }

    const sentences: TablesInsert<'sentences'>[] = []
    const senses_in_sentences: TablesInsert<'senses_in_sentences'>[] = []

    if (typeof _entry.xe === 'string') {
      const sentence_id = randomUUID()

      const sentence: TablesInsert<'sentences'> = {
        id: sentence_id,
        created_by: entry.created_by || admin_uid_if_no_owner,
        updated_by: entry.updated_by || entry.created_by || admin_uid_if_no_owner,
        dictionary_id: entry.dictionary_id,
        text: { default: _entry.xe },
      }
      sentences.push(sentence)

      const sense_in_sentences: TablesInsert<'senses_in_sentences'> = {
        sentence_id,
        sense_id: first_sense_from_base.id,
        created_by: entry.created_by || admin_uid_if_no_owner,
        created_at: entry.created_at || new Date().toISOString(),
      }
      senses_in_sentences.push(sense_in_sentences)
      delete _entry.xe
    }

    const photos: TablesInsert<'photos'>[] = []
    const videos: TablesInsert<'videos'>[] = []

    delete _entry.id
    delete _entry.dictionary_id
    delete _entry.dictId

    return [_entry, { entry, senses, sentences, audios, audio_speakers, photos, videos }]
  } catch (e) {
    console.log(e, _entry)
    // @ts-expect-error
    throw new Error(e)
  }
}

function seconds_to_timestamp_string(seconds: number): string {
  return new Date(seconds * 1000).toISOString()
}

function isEmptyArray(value: any): boolean {
  return Array.isArray(value) && value.length === 0
}

function isEmptyObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Object.keys(value).length
}
