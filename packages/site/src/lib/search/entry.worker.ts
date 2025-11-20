import { expose } from 'comlink'
import type { Database, EntryData, Tables, TablesInsert, TablesUpdate } from '@living-dictionaries/types'
import { createClient } from '@supabase/supabase-js'
import { clear } from 'idb-keyval'
import { _search_entries, create_index, update_index_entry } from './orama.worker'
import type { Supabase } from '$lib/supabase'
import { cached_data_table, cached_join_table } from '$lib/supabase/cached-data'

const log = false
let supabase: Supabase | undefined

let dictionary_id: string
let upsert_entry_data: (entries_data: Record<string, EntryData>) => Promise<void>
let delete_entry: (entry_id: string) => Promise<void>
let set_speakers: (speakers: Tables<'speakers'>[]) => Promise<void>
let set_tags: (tags: Tables<'tags'>[]) => Promise<void>
let set_dialects: (dialects: Tables<'dialects'>[]) => Promise<void>
let mark_search_index_updated: () => Promise<void>

let entries: Record<string, Tables<'entries'>>
let senses: Record<string, Tables<'senses'>>
let audios: Record<string, Tables<'audio'>>
let speakers: Record<string, Tables<'speakers'>>
let audio_speakers: Record<string, Tables<'audio_speakers'>>
let tags: Record<string, Tables<'tags'>>
let entry_tags: Record<string, Tables<'entry_tags'>>
let dialects: Record<string, Tables<'dialects'>>
let entry_dialects: Record<string, Tables<'entry_dialects'>>
let photos: Record<string, Tables<'photos'>>
let sense_photos: Record<string, Tables<'sense_photos'>>
let videos: Record<string, Tables<'videos'>>
let video_speakers: Record<string, Tables<'video_speakers'>>
let sense_videos: Record<string, Tables<'sense_videos'>>
let sentences: Record<string, Tables<'sentences'>>
let senses_in_sentences: Record<string, Tables<'senses_in_sentences'>>

const entry_id_to_tags: Record<string, Tables<'tags'>[]> = {}
const entry_id_to_dialects: Record<string, Tables<'dialects'>[]> = {}
const entry_id_to_senses: Record<string, Tables<'senses'>[]> = {}
const sense_id_to_sentences: Record<string, Tables<'sentences'>[]> = {}
const sense_id_to_photos: Record<string, Tables<'photos'>[]> = {}
const video_id_to_speakers: Record<string, Tables<'speakers'>[]> = {}
const sense_id_to_videos: Record<string, Tables<'videos'>[]> = {}
const audio_id_to_speakers: Record<string, Tables<'speakers'>[]> = {}
const entry_id_to_audios: Record<string, Tables<'audio'>[]> = {}

const sentence_id_to_sense_ids: Record<string, string[]> = {}
const photo_id_to_sense_ids: Record<string, string[]> = {}
const video_id_to_sense_ids: Record<string, string[]> = {}

const operations = {
  insert_entry: async (entry: TablesInsert<'entries'>) => {
    entries[entry.id] = entry as Tables<'entries'>
    await process_and_update_entry(entry as Tables<'entries'>)
  },
  update_entry: async (entry: TablesUpdate<'entries'>) => {
    if (entry.deleted) {
      await delete_entry(entry.id)
      await update_index_entry(entry as EntryData, dictionary_id)
      await mark_search_index_updated()
      return
    }
    const old_entry = entries[entry.id]
    if (!old_entry) return
    entries[entry.id] = { ...old_entry, ...entry } as Tables<'entries'>
    await process_and_update_entry(entries[entry.id])
  },
  insert_sense: async (sense: TablesInsert<'senses'>) => {
    senses[sense.id] = sense as Tables<'senses'>
    if (!entry_id_to_senses[sense.entry_id]) entry_id_to_senses[sense.entry_id] = []
    entry_id_to_senses[sense.entry_id].push(sense as Tables<'senses'>)
    await process_and_update_entry(entries[sense.entry_id])
  },
  update_sense: async (sense: TablesUpdate<'senses'>) => {
    const entry_id = senses[sense.id]?.entry_id
    if (sense.deleted) {
      delete senses[sense.id]
      entry_id_to_senses[entry_id] = entry_id_to_senses[entry_id].filter(s => s.id !== sense.id)
    } else {
      const old_sense = senses[sense.id]
      if (!old_sense) return
      senses[sense.id] = { ...old_sense, ...sense }
      entry_id_to_senses[entry_id] = entry_id_to_senses[entry_id].map((s) => {
        if (s.id === sense.id) {
          return senses[sense.id]
        }
        return s
      })
    }
    await process_and_update_entry(entries[entry_id])
  },
  insert_audio: async (audio: TablesInsert<'audio'>) => {
    const audio_with_temp_updated_at = { ...audio, updated_at: new Date().toISOString() } as Tables<'audio'>
    audios[audio.id] = audio_with_temp_updated_at
    if (!entry_id_to_audios[audio.entry_id]) entry_id_to_audios[audio.entry_id] = []
    entry_id_to_audios[audio.entry_id].push(audio_with_temp_updated_at)
    await process_and_update_entry(entries[audio.entry_id])
  },
  update_audio: async (audio: TablesUpdate<'audio'>) => {
    const old_audio = audios[audio.id]
    if (!old_audio) return
    const new_audio = { ...old_audio, ...audio }
    const { entry_id } = old_audio
    if (audio.deleted) {
      delete audios[audio.id]
      entry_id_to_audios[entry_id] = entry_id_to_audios[entry_id].filter(a => a.id !== audio.id)
    } else {
      audios[audio.id] = new_audio
      entry_id_to_audios[entry_id] = entry_id_to_audios[entry_id].map((a) => {
        if (a.id === audio.id) {
          return new_audio
        }
        return a
      })
    }
    await process_and_update_entry(entries[entry_id])
  },
  insert_photo: async (photo: TablesInsert<'photos'>, sense_id: string) => {
    photos[photo.id] = photo as Tables<'photos'>
    if (!sense_id_to_photos[sense_id]) sense_id_to_photos[sense_id] = []
    sense_id_to_photos[sense_id].push(photo as Tables<'photos'>)
    if (!photo_id_to_sense_ids[photo.id]) photo_id_to_sense_ids[photo.id] = []
    photo_id_to_sense_ids[photo.id].push(sense_id)
    const entry_id = senses[sense_id]?.entry_id
    await process_and_update_entry(entries[entry_id])
  },
  update_photo: async (photo: TablesUpdate<'photos'>) => {
    const sense_id = photo_id_to_sense_ids[photo.id]?.[0]
    if (photo.deleted) {
      delete photos[photo.id]
      sense_id_to_photos[sense_id] = sense_id_to_photos[sense_id].filter(p => p.id !== photo.id)
    } else {
      const old_photo = photos[photo.id]
      if (!old_photo) return
      photos[photo.id] = { ...old_photo, ...photo }
      sense_id_to_photos[sense_id] = sense_id_to_photos[sense_id].map((p) => {
        if (p.id === photo.id) {
          return photos[photo.id]
        }
        return p
      })
    }
    const entry_id = senses[sense_id]?.entry_id
    await process_and_update_entry(entries[entry_id])
  },
  insert_video: async (video: TablesInsert<'videos'>, sense_id: string) => {
    videos[video.id] = video as Tables<'videos'>
    if (!sense_id_to_videos[sense_id]) sense_id_to_videos[sense_id] = []
    sense_id_to_videos[sense_id].push(video as Tables<'videos'>)
    if (!video_id_to_sense_ids[video.id]) video_id_to_sense_ids[video.id] = []
    video_id_to_sense_ids[video.id].push(sense_id)
    const entry_id = senses[sense_id]?.entry_id
    await process_and_update_entry(entries[entry_id])
  },
  update_video: async (video: TablesUpdate<'videos'>) => {
    const sense_id = video_id_to_sense_ids[video.id]?.[0]
    if (video.deleted) {
      delete videos[video.id]
      sense_id_to_videos[sense_id] = sense_id_to_videos[sense_id].filter(v => v.id !== video.id)
    } else {
      const old_video = videos[video.id]
      if (!old_video) return
      videos[video.id] = { ...old_video, ...video }
      sense_id_to_videos[sense_id] = sense_id_to_videos[sense_id].map((v) => {
        if (v.id === video.id) {
          return videos[video.id]
        }
        return v
      })
    }
    const entry_id = senses[sense_id]?.entry_id
    await process_and_update_entry(entries[entry_id])
  },
  insert_speaker: async (speaker: TablesInsert<'speakers'>) => {
    speakers[speaker.id] = speaker as Tables<'speakers'>
    await set_speakers(Object.values(speakers))
  },
  insert_audio_speaker: async ({ audio_id, speaker_id }: TablesInsert<'audio_speakers'>) => {
    if (!audio_id_to_speakers[audio_id]) audio_id_to_speakers[audio_id] = []
    audio_id_to_speakers[audio_id].push(speakers[speaker_id])
    const entry_id = audios[audio_id]?.entry_id
    entry_id_to_audios[entry_id] = entry_id_to_audios[entry_id].map((a) => {
      if (a.id === audio_id) {
        return {
          ...a,
          speakers: audio_id_to_speakers[audio_id],
        }
      }
      return a
    })
    await process_and_update_entry(entries[entry_id])
  },
  delete_audio_speaker: async ({ audio_id, speaker_id }: TablesUpdate<'audio_speakers'>) => {
    audio_id_to_speakers[audio_id] = audio_id_to_speakers[audio_id].filter(s => s.id !== speaker_id)
    const entry_id = audios[audio_id]?.entry_id
    entry_id_to_audios[entry_id] = entry_id_to_audios[entry_id].map((a) => {
      if (a.id === audio_id) {
        return {
          ...a,
          speakers: null,
        }
      }
      return a
    })
    await process_and_update_entry(entries[entry_id])
  },
  insert_video_speaker: async ({ video_id, speaker_id }: TablesInsert<'video_speakers'>) => {
    if (!video_id_to_speakers[video_id]) video_id_to_speakers[video_id] = []
    video_id_to_speakers[video_id].push(speakers[speaker_id])
    const sense_id = video_id_to_sense_ids[video_id]?.[0]
    sense_id_to_videos[sense_id] = sense_id_to_videos[sense_id].map((v) => {
      if (v.id === video_id) {
        return {
          ...v,
          speakers: video_id_to_speakers[video_id],
        }
      }
      return v
    })
    const entry_id = senses[sense_id]?.entry_id
    await process_and_update_entry(entries[entry_id])
  },
  delete_video_speaker: async ({ video_id, speaker_id }: TablesUpdate<'video_speakers'>) => {
    video_id_to_speakers[video_id] = video_id_to_speakers[video_id].filter(s => s.id !== speaker_id)
    const sense_id = video_id_to_sense_ids[video_id]?.[0]
    sense_id_to_videos[sense_id] = sense_id_to_videos[sense_id].map((v) => {
      if (v.id === video_id) {
        return {
          ...v,
          speakers: null,
        }
      }
      return v
    })
    const entry_id = senses[sense_id]?.entry_id
    await process_and_update_entry(entries[entry_id])
  },
  insert_sentence: async (sentence: TablesInsert<'sentences'>, sense_id: string) => {
    sentences[sentence.id] = sentence as Tables<'sentences'>
    if (!sense_id_to_sentences[sense_id]) sense_id_to_sentences[sense_id] = []
    sense_id_to_sentences[sense_id].push(sentence as Tables<'sentences'>)
    if (!sentence_id_to_sense_ids[sentence.id]) sentence_id_to_sense_ids[sentence.id] = []
    sentence_id_to_sense_ids[sentence.id].push(sense_id)
    const entry_id = senses[sense_id]?.entry_id
    await process_and_update_entry(entries[entry_id])
  },
  update_sentence: async (sentence: TablesUpdate<'sentences'>) => {
    const sense_id = sentence_id_to_sense_ids[sentence.id]?.[0]
    if (sentence.deleted) {
      delete sentences[sentence.id]
      sense_id_to_sentences[sense_id] = sense_id_to_sentences[sense_id].filter(s => s.id !== sentence.id)
    } else {
      const old_sentence = sentences[sentence.id]
      if (!old_sentence) return
      sentences[sentence.id] = { ...old_sentence, ...sentence }
      sense_id_to_sentences[sense_id] = sense_id_to_sentences[sense_id].map((s) => {
        if (s.id === sentence.id) {
          return sentences[sentence.id]
        }
        return s
      })
    }
    const entry_id = senses[sense_id]?.entry_id
    await process_and_update_entry(entries[entry_id])
  },
  insert_tag: async (tag: TablesInsert<'tags'>) => {
    tags[tag.id] = tag as Tables<'tags'>
    await set_tags(Object.values(tags))
  },
  insert_entry_tag: async ({ entry_id, tag_id }: TablesInsert<'entry_tags'>) => {
    if (!entry_id_to_tags[entry_id]) entry_id_to_tags[entry_id] = []
    entry_id_to_tags[entry_id].push(tags[tag_id])
    await process_and_update_entry(entries[entry_id])
  },
  delete_entry_tag: async ({ entry_id, tag_id }: TablesUpdate<'entry_tags'>) => {
    entry_id_to_tags[entry_id] = entry_id_to_tags[entry_id].filter(t => t.id !== tag_id)
    await process_and_update_entry(entries[entry_id])
  },
  insert_dialect: async (dialect: TablesInsert<'dialects'>) => {
    dialects[dialect.id] = dialect as Tables<'dialects'>
    await set_dialects(Object.values(dialects))
  },
  insert_entry_dialect: async ({ entry_id, dialect_id }: TablesInsert<'entry_dialects'>) => {
    if (!entry_id_to_dialects[entry_id]) entry_id_to_dialects[entry_id] = []
    entry_id_to_dialects[entry_id].push(dialects[dialect_id])
    await process_and_update_entry(entries[entry_id])
  },
  delete_entry_dialect: async ({ entry_id, dialect_id }: TablesUpdate<'entry_dialects'>) => {
    entry_id_to_dialects[entry_id] = entry_id_to_dialects[entry_id].filter(d => d.id !== dialect_id)
    await process_and_update_entry(entries[entry_id])
  },
}

async function process_and_update_entry(entry: Tables<'entries'>) {
  const entry_data = process_entry(entry)
  await upsert_entry_data({ [entry.id]: entry_data })
  await update_index_entry(entry_data, dictionary_id)
  await mark_search_index_updated()
}

export interface InitEntryWorkerOptions {
  dictionary_id: string
  can_edit: boolean
  PUBLIC_SUPABASE_API_URL: string
  PUBLIC_SUPABASE_ANON_KEY: string
  set_entries_data: (entries_data: Record<string, EntryData>) => void
  upsert_entry_data: (entries_data: Record<string, EntryData>) => void
  delete_entry: (entry_id: string) => void
  set_speakers: (speakers: Tables<'speakers'>[]) => void
  set_tags: (tags: Tables<'tags'>[]) => void
  set_dialects: (dialects: Tables<'dialects'>[]) => void
  set_loading: (loading: boolean) => void
  mark_search_index_updated: () => void
}

export async function init_entries(
  options: {
    dictionary_id: string
    can_edit: boolean
    PUBLIC_SUPABASE_API_URL: string
    PUBLIC_SUPABASE_ANON_KEY: string
  },
  set_entries_data: (entries_data: Record<string, EntryData>) => Promise<void>,
  _upsert_entry_data: (entries_data: Record<string, EntryData>) => Promise<void>,
  _delete_entry: (entry_id: string) => Promise<void>,
  _set_speakers: (speakers: Tables<'speakers'>[]) => Promise<void>,
  _set_tags: (tags: Tables<'tags'>[]) => Promise<void>,
  _set_dialects: (dialects: Tables<'dialects'>[]) => Promise<void>,
  set_loading: (loading: boolean) => Promise<void>,
  _mark_search_index_updated: () => Promise<void>,
) {
  upsert_entry_data = _upsert_entry_data
  delete_entry = _delete_entry
  set_speakers = _set_speakers
  set_tags = _set_tags
  set_dialects = _set_dialects
  mark_search_index_updated = _mark_search_index_updated

  ;({ dictionary_id } = options)
  const { can_edit, PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY } = options

  const cached = await load_cache(dictionary_id)
  if (cached) {
    set_entries_data(cached.reduce((acc, entry) => {
      acc[entry.id] = entry
      return acc
    }, {}))
    await create_index(cached, dictionary_id)
    mark_search_index_updated()
    console.info('can search using cached entries_data')

    if (!can_edit) {
      set_loading(false)
      return
    }
  }

  if (!supabase) {
    supabase = createClient<Database>(PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: true } })
  }

  const entries_promise = cached_data_table({ table: 'entries', include: ['coordinates', 'elicitation_id', 'interlinearization', 'lexeme', 'morphology', 'notes', 'phonetic', 'scientific_names', 'sources'], dictionary_id, supabase, log })
  const senses_promise = cached_data_table({ table: 'senses', include: ['created_at', 'entry_id', 'definition', 'glosses', 'noun_class', 'parts_of_speech', 'plural_form', 'semantic_domains', 'variant', 'write_in_semantic_domains'], dictionary_id, supabase, log })
  const audios_promise = cached_data_table({ table: 'audio', include: ['created_at', 'entry_id', 'source', 'storage_path'], dictionary_id, supabase, log })
  const speakers_promise = cached_data_table({ table: 'speakers', include: ['birthplace', 'decade', 'gender', 'name'], dictionary_id, supabase, log })
  const tags_promise = cached_data_table({ table: 'tags', include: ['name', 'private'], dictionary_id, supabase, log })
  const dialects_promise = cached_data_table({ table: 'dialects', include: ['name'], dictionary_id, supabase, log })
  const photos_promise = cached_data_table({ table: 'photos', include: ['photographer', 'storage_path', 'serving_url', 'source'], dictionary_id, supabase, log })
  const videos_promise = cached_data_table({ table: 'videos', include: ['hosted_elsewhere', 'source', 'storage_path', 'videographer'], dictionary_id, supabase, log })
  const sentences_promise = cached_data_table({ table: 'sentences', include: ['text', 'translation'], dictionary_id, supabase, log })

  const audio_speakers_promise = cached_join_table({ table: 'audio_speakers', id_field_1: 'audio_id', id_field_2: 'speaker_id', dictionary_id, supabase, log })
  const entry_tags_promise = cached_join_table({ table: 'entry_tags', id_field_1: 'entry_id', id_field_2: 'tag_id', dictionary_id, supabase, log })
  const entry_dialects_promise = cached_join_table({ table: 'entry_dialects', id_field_1: 'entry_id', id_field_2: 'dialect_id', dictionary_id, supabase, log })
  const sense_photos_promise = cached_join_table({ table: 'sense_photos', id_field_1: 'sense_id', id_field_2: 'photo_id', dictionary_id, supabase, log })
  const video_speakers_promise = cached_join_table({ table: 'video_speakers', id_field_1: 'video_id', id_field_2: 'speaker_id', dictionary_id, supabase, log })
  const sense_videos_promise = cached_join_table({ table: 'sense_videos', id_field_1: 'sense_id', id_field_2: 'video_id', dictionary_id, supabase, log })
  const senses_in_sentences_promise = cached_join_table({ table: 'senses_in_sentences', id_field_1: 'sense_id', id_field_2: 'sentence_id', dictionary_id, supabase, log })

    ;([
    entries,
    senses,
    audios,
    speakers,
    tags,
    dialects,
    photos,
    videos,
    sentences,
    audio_speakers,
    entry_tags,
    entry_dialects,
    sense_photos,
    video_speakers,
    sense_videos,
    senses_in_sentences,
  ] = await Promise.all([
    entries_promise,
    senses_promise,
    audios_promise,
    speakers_promise,
    tags_promise,
    dialects_promise,
    photos_promise,
    videos_promise,
    sentences_promise,
    audio_speakers_promise,
    entry_tags_promise,
    entry_dialects_promise,
    sense_photos_promise,
    video_speakers_promise,
    sense_videos_promise,
    senses_in_sentences_promise,
  ]))

  for (const entry_tag of Object.values(entry_tags)) {
    if (!entry_id_to_tags[entry_tag.entry_id]) entry_id_to_tags[entry_tag.entry_id] = []
    const tag = tags[entry_tag.tag_id]
    entry_id_to_tags[entry_tag.entry_id].push(tag)
  }

  for (const entry_dialect of Object.values(entry_dialects)) {
    if (!entry_id_to_dialects[entry_dialect.entry_id]) entry_id_to_dialects[entry_dialect.entry_id] = []
    const dialect = dialects[entry_dialect.dialect_id]
    entry_id_to_dialects[entry_dialect.entry_id].push(dialect)
  }

  for (const sense of Object.values(senses)) {
    if (!entry_id_to_senses[sense.entry_id]) entry_id_to_senses[sense.entry_id] = []
    entry_id_to_senses[sense.entry_id].push(sense)
    if (entry_id_to_senses[sense.entry_id].length > 1) {
      entry_id_to_senses[sense.entry_id].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }
  }

  for (const { sense_id, sentence_id } of Object.values(senses_in_sentences)) {
    if (!sense_id_to_sentences[sense_id]) sense_id_to_sentences[sense_id] = []
    sense_id_to_sentences[sense_id].push(sentences[sentence_id])
    if (!sentence_id_to_sense_ids[sentence_id]) sentence_id_to_sense_ids[sentence_id] = []
    sentence_id_to_sense_ids[sentence_id].push(sense_id)
  }

  for (const { sense_id, photo_id } of Object.values(sense_photos)) {
    if (!sense_id_to_photos[sense_id]) sense_id_to_photos[sense_id] = []
    sense_id_to_photos[sense_id].push(photos[photo_id])
    if (!photo_id_to_sense_ids[photo_id]) photo_id_to_sense_ids[photo_id] = []
    photo_id_to_sense_ids[photo_id].push(sense_id)
  }

  for (const video_speaker of Object.values(video_speakers)) {
    if (!video_id_to_speakers[video_speaker.video_id]) video_id_to_speakers[video_speaker.video_id] = []
    const speaker = speakers[video_speaker.speaker_id]
    video_id_to_speakers[video_speaker.video_id].push(speaker)
  }
  for (const { sense_id, video_id } of Object.values(sense_videos)) {
    if (!sense_id_to_videos[sense_id]) sense_id_to_videos[sense_id] = []
    const video = videos[video_id]

    sense_id_to_videos[sense_id].push({
      ...video,
      ...(video_id_to_speakers[video_id] ? { speakers: video_id_to_speakers[video_id] } : {}),
    })

    if (!video_id_to_sense_ids[video_id]) video_id_to_sense_ids[video_id] = []
    video_id_to_sense_ids[video_id].push(sense_id)
  }

  for (const audio_speaker of Object.values(audio_speakers)) {
    if (!audio_id_to_speakers[audio_speaker.audio_id]) audio_id_to_speakers[audio_speaker.audio_id] = []
    const speaker = speakers[audio_speaker.speaker_id]
    audio_id_to_speakers[audio_speaker.audio_id].push(speaker)
  }
  for (const audio of Object.values(audios)) {
    if (!entry_id_to_audios[audio.entry_id]) entry_id_to_audios[audio.entry_id] = []
    entry_id_to_audios[audio.entry_id].push({
      ...audio,
      ...(audio_id_to_speakers[audio.id] ? { speakers: audio_id_to_speakers[audio.id] } : {}),
    })
    if (entry_id_to_audios[audio.entry_id].length > 1) {
      entry_id_to_audios[audio.entry_id].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }
  }

  console.time('Process Entries Time')
  const processed_data: Record<string, EntryData> = {}
  for (const entry of Object.values(entries)) {
    processed_data[entry.id] = process_entry(entry)
  }
  console.timeEnd('Process Entries Time')

  set_entries_data(processed_data)
  set_tags(Object.values(tags))
  set_dialects(Object.values(dialects))
  set_speakers(Object.values(speakers))

  await create_index(Object.values(processed_data), dictionary_id)
  mark_search_index_updated()
  set_loading(false)
}

function process_entry(entry: Tables<'entries'>) {
  const { id, deleted, dictionary_id, created_at, created_by, updated_by, updated_at, ...main } = entry

  const senses_for_entry = entry_id_to_senses[id] || []
  const senses_with_all = senses_for_entry.map((sense) => {
    const { entry_id, ...sense_to_include } = sense

    return {
      ...sense_to_include,
      ...(sense_id_to_sentences[sense.id] ? { sentences: sense_id_to_sentences[sense.id] } : {}),
      ...(sense_id_to_photos[sense.id] ? { photos: sense_id_to_photos[sense.id] } : {}),
      ...(sense_id_to_videos[sense.id] ? { videos: sense_id_to_videos[sense.id] } : {}),
    }
  })
  return {
    id,
    main,
    updated_at,
    senses: senses_with_all,
    ...(entry_id_to_audios[id] ? { audios: entry_id_to_audios[id] } : {}),
    ...(entry_id_to_tags[id] ? { tags: entry_id_to_tags[id] } : {}),
    ...(entry_id_to_dialects[id] ? { dialects: entry_id_to_dialects[id] } : {}),
    ...(deleted ? { deleted } : {}),
  }
}

async function load_cache(dictionary_id: string) {
  const url = `https://cache.livingdictionaries.app/entries_data/${dictionary_id}.json`
  try {
    console.info('loading cached entries_data')
    const response = await fetch(url)
    if (!response.ok) {
      console.info('cached entries_data not found')
      return null
    }
    const serialized_json = await response.text()
    console.info('got cached entries_data')
    const deserialized = JSON.parse(serialized_json) as EntryData[]
    console.info('parsed cached entries_data')
    return deserialized
  } catch (err) {
    console.error('Error loading cached index', err)
  }
}

export const api = {
  init_entries,
  reset_caches: clear,
  search_entries: _search_entries,
  ...operations,
}

expose(api)
