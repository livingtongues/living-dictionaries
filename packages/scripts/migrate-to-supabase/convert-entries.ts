// import { randomUUID } from 'node:crypto'
import type { ActualDatabaseEntry } from '@living-dictionaries/types'
import type { TablesInsert } from '../../site/src/lib/supabase/generated.types'
import { log_once } from './log-once'

let id_count = 0
function randomUUID() {
  id_count++
  return `use-crypto-uuid-in-real-thing_${id_count}`
}

const admin_uid_if_no_owner = 'de2d3715-6337-45a3-a81a-d82c3210b2a7' // jacob@livingtongues.org
const old_talking_dictionaries = '00000000-0000-0000-0000-000000000000' // TODO - decide what user to use or create one for attribution

export function convert_entry(_entry: Partial<ActualDatabaseEntry> & Record<string, any>) {
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
    if (typeof _entry.ca?.seconds === 'number') {
      entry.created_at = seconds_to_timestamp_string(_entry.ca.seconds)
      delete _entry.ca
    }
    if (typeof _entry.createdBy === 'string') {
      entry.created_by = _entry.createdBy
      delete _entry.createdBy
    }
    if (typeof _entry.cb === 'string') {
      entry.created_by = _entry.cb
      delete _entry.cb
    }
    if (typeof _entry.ab === 'string') {
      if (!entry.created_by)
        entry.created_by = _entry.ab
      delete _entry.ab
    }

    if (!entry.created_by)
      entry.created_by = admin_uid_if_no_owner

    if (entry.created_by === 'OTD')
      entry.created_by = old_talking_dictionaries

    const first_sense_from_base: TablesInsert<'senses'> = {
      entry_id: _entry.id,
      created_by: entry.created_by,
      updated_by: entry.updated_by || entry.created_by,
      id: randomUUID(),
    }

    if (_entry.lo && _entry.lo1) {
      throw new Error(`both lo and lo1 for ${_entry.id}`)
    }

    if (!_entry.lx) {
      throw new Error(`no lx for ${_entry.id}`)
    }
    entry.lexeme = { default: _entry.lx }
    delete _entry.lx

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

        if (key === 'ei') {
          entry.elicitation_id = value
          delete _entry[key]
          continue
        }

        if (key === 'ii') {
          // TODO: create a history change with the ii - resume with pnpm t -- --ui convert-entries, https://supabase.com/dashboard/project/actkqboqpzniojhgtqzw/database/schemas
          log_once(`TODO - ii:${value} in ${entry.dictionary_id}`)
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

        if (key === 'nc') {
          first_sense_from_base.noun_class = value
          delete _entry[key]
          continue
        }

        if (key === 'nt') {
          entry.notes = { default: value }
          delete _entry[key]
          continue
        }

        if (key === 'mr') {
          entry.morphology = value
          delete _entry[key]
          continue
        }

        if (key === 'pl') {
          entry.plural_form = value
          delete _entry[key]
          continue
        }

        if (key === 'lo' || key === 'lo1') {
          entry.lexeme.lo1 = value
          delete _entry[key]
          continue
        }
        // if (key === 'lo2') {
        //   entry.lexeme.lo2 = value
        //   delete _entry[key]
        //   continue
        // }
        // if (key === 'lo3') {
        //   entry.lexeme.lo3 = value
        //   delete _entry[key]
        //   continue
        // }
        // if (key === 'lo4') {
        //   entry.lexeme.lo4 = value
        //   delete _entry[key]
        //   continue
        // }
        // if (key === 'lo5') {
        //   entry.lexeme.lo5 = value
        //   delete _entry[key]
        //   continue
        // }
      }

      if (key === 'di') {
        if (typeof value === 'string')
          entry.dialects = [value]
        else if (Array.isArray(value))
          entry.dialects = value
        delete _entry[key]
        continue
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
        if (Array.isArray(value)) {
          first_sense_from_base.write_in_semantic_domains = value
          delete _entry[key]
          continue
        }
      }

      if (key === 'sd') {
        if (Array.isArray(value)) {
          first_sense_from_base.write_in_semantic_domains = value
          delete _entry[key]
          continue
        }
      }

      if (key === 'scn') {
        if (Array.isArray(value)) {
          entry.scientific_names = value
          delete _entry[key]
          continue
        }
      }

      if (key === 'sdn') {
        if (Array.isArray(value)) {
          first_sense_from_base.semantic_domains = value
          delete _entry[key]
          continue
        }
      }

      if (key === 'sr') {
        if (Array.isArray(value)) {
          entry.sources = value
          delete _entry[key]
          continue
        }
      }
    }

    if (typeof _entry.gl === 'object') {
      first_sense_from_base.glosses = _entry.gl
      delete _entry.gl
    }

    const senses: TablesInsert<'senses'>[] = [first_sense_from_base]
    const sentences: TablesInsert<'sentences'>[] = []
    const senses_in_sentences: TablesInsert<'senses_in_sentences'>[] = []

    let vernacular_sentence: string
    let translation: Record<string, string> = null
    if (_entry.xs) {
      if (typeof _entry.xs.vernacular === 'string') {
        vernacular_sentence = _entry.xs.vernacular
        delete _entry.xs.vernacular
      }
      if (!vernacular_sentence && typeof _entry.xs.vn === 'string') {
        vernacular_sentence = _entry.xs.vn
        delete _entry.xs.vn
      }
      for (const key of Object.keys(_entry.xs)) {
        translation = { ...(translation || {}), [key]: _entry.xs[key] }
        log_once(`Example Sentence language: ${key}`)
      }
      delete _entry.xs
    }
    if (!vernacular_sentence && typeof _entry.xe === 'string') {
      vernacular_sentence = _entry.xe
      delete _entry.xe
    }

    if (vernacular_sentence) {
      const sentence_id = randomUUID()

      const sentence: TablesInsert<'sentences'> = {
        id: sentence_id,
        created_by: entry.created_by,
        updated_by: entry.updated_by || entry.created_by,
        dictionary_id: entry.dictionary_id,
        text: { default: vernacular_sentence },
        ...(translation ? { translation } : {}),
      }
      sentences.push(sentence)

      const sense_in_sentences: TablesInsert<'senses_in_sentences'> = {
        sentence_id,
        sense_id: first_sense_from_base.id,
        created_by: entry.created_by,
        ...(entry.created_at ? { created_at: entry.created_at } : {}),
      }
      senses_in_sentences.push(sense_in_sentences)
    }

    const audios: TablesInsert<'audio'>[] = []
    const audio_speakers: TablesInsert<'audio_speakers'>[] = []

    if (_entry.sf && _entry.sfs?.length) {
      throw new Error(`sf and sfs in ${entry.dictionary_id}`)
    }
    if (_entry.sf || _entry.sfs?.length === 1) {
      const audio_id = randomUUID()
      const sf = _entry.sf || _entry.sfs[0] as unknown as ActualDatabaseEntry['sf']
      const { ab, path, ts, cr, sp, speakerName, source } = sf
      if (speakerName) {
        log_once(`TODO: create speaker:${speakerName} in ${entry.dictionary_id}`)
        delete sf.speakerName
      }
      delete sf.mt
      if (!ab && !entry.created_by)
        console.info(`No ab for ${_entry.id} sf`)
      const audio: TablesInsert<'audio'> = {
        id: audio_id,
        created_by: ab || entry.created_by,
        updated_by: ab || entry.created_by,
        storage_path: path,
      }
      delete sf.ab
      delete sf.path
      if (ts) {
        if (ts.toString().length === 13)
          audio.created_at = new Date(ts).toISOString()
        // @ts-expect-error
        else if (typeof ts === 'object' && '_seconds' in ts)
          // @ts-expect-error
          audio.created_at = seconds_to_timestamp_string(ts._seconds)
        else
          throw new Error(`odd timestamp for ${_entry.id}: ${ts}`)
        delete sf.ts
      }
      if (cr) {
        if (cr !== 'Jacob Bowdoin')
          audio.source = cr
        else
          log_once(`Jacob given audio credit in dict:${entry.dictionary_id}`)
        delete sf.cr
      }
      if (source && !cr) {
        if (source !== 'local_import')
          audio.source = source
        delete sf.source
      }
      audios.push(audio)
      let speaker_id: string = null
      if (Array.isArray(sp) && sp.length === 1) {
        [speaker_id] = sp
      }
      if (typeof sp === 'string') {
        speaker_id = sp
      }
      if (speaker_id) {
        audio_speakers.push({
          audio_id,
          speaker_id,
          created_by: ab || entry.created_by,
          ...(audio.created_at ? { created_at: audio.created_at } : {}),
        })
        delete sf.sp
      }
      if (!Object.keys(sf).length) {
        delete _entry.sf
        delete _entry.sfs
      }
    }

    const photos: TablesInsert<'photos'>[] = []
    const sense_photos: TablesInsert<'sense_photos'>[] = []

    if (_entry.pf) {
      const photo_id = randomUUID()
      const { ab, path, ts, cr, gcs, sc, source, uploadedAt, uploadedBy } = _entry.pf
      if (uploadedAt)
        console.info({ uploadedAt })
      if (!ab && !entry.created_by)
        console.info(`No ab for ${_entry.id} pf`)
      const photo: TablesInsert<'photos'> = {
        id: photo_id,
        created_by: ab || uploadedBy || entry.created_by,
        updated_by: ab || uploadedBy || entry.created_by,
        storage_path: path,
        serving_url: remove_newline_from_end(gcs),
      }
      delete _entry.pf.ab
      delete _entry.pf.path
      delete _entry.pf.gcs
      if (ts) {
        if (ts.toString().length === 13)
          photo.created_at = new Date(ts).toISOString()
        // @ts-expect-error
        else if (typeof ts === 'object' && '_seconds' in ts)
        // @ts-expect-error
          photo.created_at = seconds_to_timestamp_string(ts._seconds)
        else
          throw new Error(`odd timestamp for ${_entry.id}: ${ts}`)
        delete _entry.pf.ts
      }
      if (cr) {
        if (cr !== 'Jacob Bowdoin')
          photo.source = cr
        else
          log_once(`Jacob given photo credit dict:${entry.dictionary_id}`)
        delete _entry.pf.cr
      }
      if (source && !photo.source) {
        if (source !== 'local_import')
          photo.source = source
        delete _entry.pf.source
      }
      // also sc may turn up in photos
      photos.push(photo)
      sense_photos.push({
        photo_id,
        sense_id: first_sense_from_base.id,
        created_by: ab || entry.created_by,
        ...(photo.created_at ? { created_at: photo.created_at } : {}),
      })
      if (!Object.keys(_entry.pf).length)
        delete _entry.pf
    }

    const videos: TablesInsert<'videos'>[] = []
    const sense_videos: TablesInsert<'sense_videos'>[] = []

    delete _entry.id
    delete _entry.dictionary_id
    delete _entry.dictId

    return [_entry, { entry, senses, sentences, senses_in_sentences, audios, audio_speakers, photos, sense_photos, videos, sense_videos }]
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

function remove_newline_from_end(value: string): string {
  return value.replace(/\n$/, '')
}
