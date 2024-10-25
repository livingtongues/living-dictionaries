import { randomUUID } from 'node:crypto'
import type { TablesInsert } from '@living-dictionaries/types'
import type { ActualDatabaseEntry } from '@living-dictionaries/types/entry.interface'
import type { ActualDatabaseVideo } from '@living-dictionaries/types/video.interface'
import { jacob_ld_user_id } from '../config-supabase'
import { get_supabase_user_id_from_firebase_uid } from './get-user-id'

interface DataForSupabase {
  entry: TablesInsert<'entries'>
  senses: TablesInsert<'senses'>[]
  sentences: TablesInsert<'sentences'>[]
  senses_in_sentences: TablesInsert<'senses_in_sentences'>[]
  audios: TablesInsert<'audio'>[]
  audio_speakers: TablesInsert<'audio_speakers'>[]
  photos: TablesInsert<'photos'>[]
  sense_photos: TablesInsert<'sense_photos'>[]
  videos: TablesInsert<'videos'>[]
  video_speakers: TablesInsert<'video_speakers'>[]
  sense_videos: TablesInsert<'sense_videos'>[]
  dialects: string[]
  new_speaker_name?: string
  prior_import_id: string | null
}

export function convert_entry(_entry: ActualDatabaseEntry & Record<string, any>, uuid: () => string = randomUUID): [any, DataForSupabase] {
  const dict_entry_id = `${_entry.dictionary_id}:${_entry.id}`
  if (_entry.deletedVfs)
    console.log(`deletedVfs in ${dict_entry_id} - youtubeId: ${_entry.deletedVfs[0].youtubeId}`)

  if (_entry.xv && _entry.xs?.vn)
    console.log(`both xv ${_entry.xv} and xs.vn ${_entry.xs.vn} for ${dict_entry_id}`)

  if (_entry.lo && _entry.lo1 && _entry.lo !== _entry.lo1)
    console.log(`lost lo: ${_entry.lo} in favor of lo1: ${_entry.lo1} for ${dict_entry_id}`)

  if (_entry.sf && _entry.sfs?.length && !_entry.sfs[0].sp.includes(_entry.sf.sp))
    console.log(`different speakers in ${dict_entry_id} - ${_entry.sf.sp} in sf and ${_entry.sfs[0].sp.join(', ')} sfs`)

  try {
    const entry: TablesInsert<'entries'> = {
      id: _entry.id!,
      dictionary_id: _entry.dictionary_id,
    } as TablesInsert<'entries'>
    let prior_import_id = null

    if (typeof _entry.updatedAt?.seconds === 'number') {
      entry.updated_at = seconds_to_timestamp_string(_entry.updatedAt.seconds)
      delete _entry.updatedAt
    }
    if (typeof _entry.ua?.seconds === 'number') {
      entry.updated_at = seconds_to_timestamp_string(_entry.ua.seconds)
      delete _entry.ua
    }
    if (typeof _entry.updatedBy === 'string') {
      entry.updated_by = get_supabase_user_id_from_firebase_uid(_entry.updatedBy)
      delete _entry.updatedBy
    }
    if (typeof _entry.ub === 'string') {
      entry.updated_by = get_supabase_user_id_from_firebase_uid(_entry.ub)
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
      entry.created_by = get_supabase_user_id_from_firebase_uid(_entry.createdBy)
      delete _entry.createdBy
    }
    if (typeof _entry.cb === 'string') {
      entry.created_by = get_supabase_user_id_from_firebase_uid(_entry.cb)
      delete _entry.cb
    }
    if (typeof _entry.ab === 'string') {
      if (!entry.created_by)
        entry.created_by = get_supabase_user_id_from_firebase_uid(_entry.ab)
      delete _entry.ab
    }

    if (entry.created_by === 'OTD' || !entry.created_by)
      entry.created_by = jacob_ld_user_id
    if (!entry.updated_by)
      entry.updated_by = entry.created_by

    const dialects = new Set<string>()

    const first_sense_from_base: TablesInsert<'senses'> = {
      entry_id: _entry.id,
      created_by: entry.created_by || entry.updated_by,
      created_at: entry.created_at || entry.updated_at,
      updated_by: entry.updated_by || entry.created_by,
      updated_at: entry.updated_at || entry.created_at,
      id: uuid(),
    }

    if (!_entry.lx)
      console.log(`no lexeme for ${dict_entry_id}`)
    entry.lexeme = { default: _entry.lx || '' }
    delete _entry.lx

    if (typeof _entry.ei === 'number') {
      // @ts-expect-error - errors because ei is not typed as a number
      entry.elicitation_id = _entry.ei.toString()
      delete _entry.ei
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

        if (key === 'ei') {
          entry.elicitation_id = value
          delete _entry[key]
          continue
        }

        // @ts-expect-error - not typed
        if (key === 'hm') {
          entry.unsupported_fields ??= {}
          entry.unsupported_fields.hm = value
          delete _entry[key]
          continue
        }

        // @ts-expect-error - not typed
        if (key === 'dt') {
          entry.unsupported_fields ??= {}
          entry.unsupported_fields.dt = value
          delete _entry[key]
          continue
        }

        // @ts-expect-error - not typed
        if (key === 'semdom') {
          entry.unsupported_fields ??= {}
          entry.unsupported_fields.semdom = value
          delete _entry[key]
          continue
        }

        // @ts-expect-error - doesn't have importId typed
        if (key === 'ii' || key === 'importId' || key === 'source') {
          // @ts-expect-error
          prior_import_id = key === 'source' ? value.replace('import: ', '') : value // source key found in miahuatec-zapotec
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

        if (key === 'in') {
          entry.interlinearization = value
          delete _entry[key]
          continue
        }

        if (key === 'va') {
          first_sense_from_base.variant = { default: value }
          delete _entry[key]
          continue
        }

        if (key === 'pl') {
          first_sense_from_base.plural_form = { default: value }
          delete _entry[key]
          continue
        }

        if (key === 'lo1') {
          entry.lexeme.lo1 = value
          delete _entry[key]
          continue
        }
        if (key === 'lo2') {
          entry.lexeme.lo2 = value
          delete _entry[key]
          continue
        }

        // lo3, lo4, lo5 are not used yet
        if (key === 'lo3') {
          entry.lexeme.lo3 = value
          delete _entry[key]
          continue
        }
        if (key === 'lo4') {
          entry.lexeme.lo4 = value
          delete _entry[key]
          continue
        }
        if (key === 'lo5') {
          entry.lexeme.lo5 = value
          delete _entry[key]
          continue
        }
      }

      if (key === 'di') {
        if (typeof value === 'string')
          dialects.add(value)
        else if (Array.isArray(value))
          value.forEach(d => dialects.add(d))
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
        if (typeof value === 'string') {
          first_sense_from_base.write_in_semantic_domains = [value]
        } else if (Array.isArray(value)) {
          first_sense_from_base.write_in_semantic_domains = value
        }
        delete _entry[key]
        continue
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
        if (typeof value === 'string') {
          entry.sources = [value]
        } else if (Array.isArray(value)) {
          entry.sources = value
        }
        delete _entry[key]
        continue
      }

      if (key === 'co') {
        entry.coordinates = value
        delete _entry[key]
        continue
      }
    }

    if (_entry.lo) {
      if (!entry.lexeme.lo1) {
        entry.lexeme.lo1 = _entry.lo
      }
      delete _entry.lo
    }
    if (_entry.local_orthography_1) {
      entry.lexeme.lo1 = _entry.local_orthography_1 // only 4 times in garifuna and lo1 is just a period in each so we overwrite that one
      delete _entry.local_orthography_1
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
      if (typeof _entry.xs.xv === 'string') {
        if (vernacular_sentence)
          throw new Error(`xs.vernacular and xs.xv in ${entry.dictionary_id}`)
        vernacular_sentence = _entry.xs.xv
        delete _entry.xs.xv
      }
      if (typeof _entry.xs.vn === 'string') {
        // if (vernacular_sentence)
        //   console.log(`xs.vernacular || xs.xv "${vernacular_sentence}" overwritten by xs.vn "${_entry.xs.vn}" for ${entry.id} in ${entry.dictionary_id}`)
        vernacular_sentence = _entry.xs.vn
        delete _entry.xs.vn
      }
      for (const key of Object.keys(_entry.xs)) {
        translation = { ...(translation || {}), [key]: _entry.xs[key] }
      }
      delete _entry.xs
    }
    if (!vernacular_sentence && typeof _entry.xe === 'string') {
      vernacular_sentence = _entry.xe
      delete _entry.xe
    }
    if (typeof _entry.xv === 'string') {
      if (!vernacular_sentence)
        vernacular_sentence = _entry.xv
      delete _entry.xv
    }

    if (vernacular_sentence) {
      const sentence_id = uuid()

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
    let new_speaker_name: string = null

    if (_entry.sf && !_entry.sf.path)
      delete _entry.sf
    if (_entry.sf?.path || _entry.sfs?.[0].path) {
      const audio_id = uuid()
      const sf = _entry.sf?.path ? _entry.sf : _entry.sfs![0] as unknown as ActualDatabaseEntry['sf']
      const { ab, path, ts, cr, sp, speakerName, source } = sf!
      if (typeof speakerName === 'string') {
        if (speakerName.trim())
          new_speaker_name = speakerName.trim()
        delete sf.speakerName
      }
      delete sf.mt
      if (!ab && !entry.created_by)
        console.info(`No ab for ${_entry.id} sf`)
      const created_by = get_supabase_user_id_from_firebase_uid(ab) || entry.created_by
      const audio: TablesInsert<'audio'> = {
        id: audio_id,
        dictionary_id: entry.dictionary_id,
        entry_id: _entry.id,
        created_by,
        updated_by: created_by,
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
        audio.updated_at = audio.created_at
        delete sf.ts
      }
      if (cr) {
        if (cr !== 'Jacob Bowdoin')
          audio.source = cr
        delete sf.cr
      }
      if (source && !cr) {
        if (source !== 'local_import' && !source.startsWith('import:'))
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
          created_by,
          ...(audio.created_at
            ? { created_at: audio.created_at }
            : entry.created_at
              ? { created_at: entry.created_at }
              : {}),
        })
        delete sf.sp
      }
      if (sf.sc && sf.sc !== 'local_import')
        throw new Error(`unexpected sc in ${_entry.id}: ${sf.sc}`)
      delete sf.sc
      if (!sf.speakerName)
        delete sf.speakerName
      if (!Object.keys(sf).length) {
        delete _entry.sf
        delete _entry.sfs
      }
    }

    const photos: TablesInsert<'photos'>[] = []
    const sense_photos: TablesInsert<'sense_photos'>[] = []

    if (_entry.pf) {
      const photo_id = uuid()
      const { ab, path, ts, sc, cr, gcs, source, uploadedAt, uploadedBy } = _entry.pf
      if (uploadedAt)
        console.info({ uploadedAt })
      if (!ab && !entry.created_by)
        console.info(`No ab for ${_entry.id} pf`)

      const created_by = get_supabase_user_id_from_firebase_uid(ab) || get_supabase_user_id_from_firebase_uid(uploadedBy) || entry.created_by
      const photo: TablesInsert<'photos'> = {
        id: photo_id,
        dictionary_id: entry.dictionary_id,
        created_by,
        updated_by: created_by,
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
        photo.updated_at = photo.created_at
        delete _entry.pf.ts
      }
      if (cr) {
        if (cr !== 'Jacob Bowdoin')
          photo.source = cr
        delete _entry.pf.cr
      }
      if (source && !photo.source) {
        if (source !== 'local_import' && !source.startsWith('import:'))
          photo.source = source
        delete _entry.pf.source
      }
      if (sc && sc !== 'local_import')
        throw new Error(`unexpected sc in ${_entry.id}: ${sc}`)
      delete _entry.pf.sc

      photos.push(photo)
      sense_photos.push({
        photo_id,
        sense_id: first_sense_from_base.id,
        created_by,
        ...(photo.created_at
          ? { created_at: photo.created_at }
          : entry.created_at
            ? { created_at: entry.created_at }
            : {}),
      })
      if (!Object.keys(_entry.pf).length)
        delete _entry.pf
    }

    const videos: TablesInsert<'videos'>[] = []
    const sense_videos: TablesInsert<'sense_videos'>[] = []
    const video_speakers: TablesInsert<'video_speakers'>[] = []

    if (_entry.deletedVfs?.[0].youtubeId) // only keep if a record of stored deleted video
      delete _entry.deletedVfs

    if (_entry.vfs?.[0] || _entry.deletedVfs?.[0]) {
      const video_id = uuid()
      const [vf] = (_entry.vfs || _entry.deletedVfs) as ActualDatabaseVideo[]
      const { ts, ab, path, sp, youtubeId, deleted, startAt } = vf
      if (!ab && !entry.created_by)
        console.info(`No ab for ${_entry.id} vfs`)
      const created_by = get_supabase_user_id_from_firebase_uid(ab) || entry.created_by
      const video: TablesInsert<'videos'> = {
        id: video_id,
        dictionary_id: entry.dictionary_id,
        created_by,
        updated_by: created_by,
      }
      delete vf.ab
      if (path) {
        video.storage_path = path
        delete vf.path
      }
      if (youtubeId) {
        video.hosted_elsewhere = {
          type: 'youtube',
          video_id: youtubeId,
          ...(startAt ? { start_at_seconds: startAt } : {}),
        }
        delete vf.youtubeId
        delete vf.startAt
      }
      if (deleted) {
        video.deleted = new Date(deleted).toISOString()
        delete vf.deleted
      }
      if (ts) {
        if (ts.toString().length === 13)
          video.created_at = new Date(ts).toISOString()
        else
          throw new Error(`odd timestamp for ${_entry.id}: ${ts}`)
        delete vf.ts
      }
      video.updated_at = video.created_at
      videos.push(video)
      sense_videos.push({
        video_id,
        sense_id: first_sense_from_base.id,
        created_by,
        ...(video.created_at
          ? { created_at: video.created_at }
          : entry.created_at
            ? { created_at: entry.created_at }
            : {}),
      })
      if (sp) {
        video_speakers.push({
          video_id,
          speaker_id: Array.isArray(sp) ? sp[0] : sp,
          created_by,
          ...(video.created_at
            ? { created_at: video.created_at }
            : entry.created_at
              ? { created_at: entry.created_at }
              : {}),
        })
        delete vf.sp
      }
      if (!Object.keys(vf).length) {
        delete _entry.vfs
        delete _entry.deletedVfs
      }
    }

    delete _entry.id
    delete _entry.dictionary_id
    delete _entry.dictId

    const supa_data: DataForSupabase = {
      entry,
      senses,
      sentences,
      senses_in_sentences,
      audios,
      audio_speakers,
      photos,
      sense_photos,
      videos,
      video_speakers,
      sense_videos,
      dialects: Array.from(dialects),
      ...(new_speaker_name ? { new_speaker_name } : {}),
      prior_import_id,
    }

    // Object.keys(supa_data).forEach((key) => {
    //   if (Array.isArray(supa_data[key]) && supa_data[key].length === 0) {
    //     delete supa_data[key]
    //   }
    // })

    return [_entry, supa_data]
  } catch (e) {
    console.log(e, _entry)
    // @ts-expect-error
    throw new Error(e)
  }
}

export function seconds_to_timestamp_string(seconds: number): string {
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
