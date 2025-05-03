import { derived, get, readable, writable } from 'svelte/store'
import type { EntryData } from '@living-dictionaries/types'
import { cached_data_store, cached_join_store } from './cached-data'
import type { Supabase } from '.'
import { browser } from '$app/environment'
import { process_entries } from '$lib/search'

export function create_entries_data_store({
  dictionary_id,
  supabase,
  can_edit = false,
  log = false,
}: {
  dictionary_id: string
  supabase: Supabase
  can_edit?: boolean
  log?: boolean
}) {
  if (!browser) {
    const { subscribe } = writable<EntryData[]>([])
    return {
      subscribe,
      loading: readable(true),
      error: readable<string>(null),
      entries: readable([]),
      senses: readable([]),
      audios: readable([]),
      speakers: readable([]),
      audio_speakers: readable([]),
      tags: readable([]),
      entry_tags: readable([]),
      dialects: readable([]),
      entry_dialects: readable([]),
      photos: readable([]),
      sense_photos: readable([]),
      videos: readable([]),
      video_speakers: readable([]),
      sense_videos: readable([]),
      sentences: readable([]),
      senses_in_sentences: readable([]),
    }
  }

  const entries = cached_data_store({ table: 'entries', include: ['coordinates', 'elicitation_id', 'interlinearization', 'lexeme', 'morphology', 'notes', 'phonetic', 'scientific_names', 'sources'], dictionary_id, supabase, log, can_edit })
  const senses = cached_data_store({ table: 'senses', include: ['entry_id', 'definition', 'glosses', 'noun_class', 'parts_of_speech', 'plural_form', 'semantic_domains', 'variant', 'write_in_semantic_domains'], dictionary_id, supabase, log, can_edit })
  const audios = cached_data_store({ table: 'audio', include: ['entry_id', 'source', 'storage_path'], dictionary_id, supabase, log, can_edit })
  const speakers = cached_data_store({ table: 'speakers', include: ['birthplace', 'decade', 'gender', 'name'], dictionary_id, supabase, log, can_edit })
  const audio_speakers = cached_join_store({ table: 'audio_speakers', id_field_1: 'audio_id', id_field_2: 'speaker_id', dictionary_id, supabase, log, can_edit })
  const tags = cached_data_store({ table: 'tags', include: ['name'], dictionary_id, supabase, log, can_edit })
  const entry_tags = cached_join_store({ table: 'entry_tags', id_field_1: 'entry_id', id_field_2: 'tag_id', dictionary_id, supabase, log, can_edit })
  const dialects = cached_data_store({ table: 'dialects', include: ['name'], dictionary_id, supabase, log, can_edit })
  const entry_dialects = cached_join_store({ table: 'entry_dialects', id_field_1: 'entry_id', id_field_2: 'dialect_id', dictionary_id, supabase, log, can_edit })
  const photos = cached_data_store({ table: 'photos', include: ['photographer', 'storage_path', 'serving_url', 'source'], dictionary_id, supabase, log, can_edit })
  const sense_photos = cached_join_store({ table: 'sense_photos', id_field_1: 'sense_id', id_field_2: 'photo_id', dictionary_id, supabase, log, can_edit })
  const videos = cached_data_store({ table: 'videos', include: ['hosted_elsewhere', 'source', 'storage_path', 'videographer'], dictionary_id, supabase, log, can_edit })
  const video_speakers = cached_join_store({ table: 'video_speakers', id_field_1: 'video_id', id_field_2: 'speaker_id', dictionary_id, supabase, log, can_edit })
  const sense_videos = cached_join_store({ table: 'sense_videos', id_field_1: 'sense_id', id_field_2: 'video_id', dictionary_id, supabase, log, can_edit })
  const sentences = cached_data_store({ table: 'sentences', include: ['text', 'translation'], dictionary_id, supabase, log, can_edit })
  const senses_in_sentences = cached_join_store({ table: 'senses_in_sentences', id_field_1: 'sense_id', id_field_2: 'sentence_id', dictionary_id, supabase, log, can_edit })

  const loading = derived([entries.loading, senses.loading, audios.loading, speakers.loading, audio_speakers.loading, tags.loading, entry_tags.loading, dialects.loading, entry_dialects.loading, photos.loading, sense_photos.loading, videos.loading, video_speakers.loading, sense_videos.loading, sentences.loading, senses_in_sentences.loading], ([$entries_loading, $senses_loading, $audios_loading, $speakers_loading, $audio_speakers_loading, $tags_loading, $entry_tags_loading, $dialects_loading, $entry_dialects_loading, $photos_loading, $sense_photos_loading, $videos_loading, $video_speakers_loading, $sense_videos_loading, $sentences_loading, $senses_in_sentences_loading]) => {
    if (log) {
      console.info({ entries_loading: $entries_loading, senses_loading: $senses_loading, audio_loading: $audios_loading, speakers_loading: $speakers_loading, audio_speakers_loading: $audio_speakers_loading, tags_loading: $tags_loading, entry_tags_loading: $entry_tags_loading, dialects_loading: $dialects_loading, entry_dialects_loading: $entry_dialects_loading, photos_loading: $photos_loading, sense_photos_loading: $sense_photos_loading, videos_loading: $videos_loading, video_speakers_loading: $video_speakers_loading, sense_videos_loading: $sense_videos_loading, sentences_loading: $sentences_loading, senses_in_sentences_loading: $senses_in_sentences_loading })
    }
    return $entries_loading || $senses_loading || $audios_loading || $speakers_loading || $audio_speakers_loading || $tags_loading || $entry_tags_loading || $dialects_loading || $entry_dialects_loading || $photos_loading || $sense_photos_loading || $videos_loading || $video_speakers_loading || $sense_videos_loading || $sentences_loading || $senses_in_sentences_loading
  }, true)

  const live_entry_data = derived([loading, entries, senses, audios, speakers, audio_speakers, tags, entry_tags, dialects, entry_dialects, photos, sense_photos, videos, video_speakers, sense_videos, sentences, senses_in_sentences,
  ], ([$loading, $entries, $senses, $audios, $speakers, $audio_speakers, $tags, $entry_tags, $dialects, $entry_dialects, $photos, $sense_photos, $videos, $video_speakers, $sense_videos, $sentences, $senses_in_sentences,
  ], set) => {
    if ($loading || !can_edit) return null
    process_entries({ $entries, $senses, $audios, $speakers, $audio_speakers, $tags, $entry_tags, $dialects, $entry_dialects, $photos, $sense_photos, $videos, $video_speakers, $sense_videos, $sentences, $senses_in_sentences }).then((entries_data) => {
      set(entries_data as EntryData[])
    })
  }, [])

  const { subscribe, set } = writable<EntryData[]>([], start)

  function start() {
    set_cache_if_comes_before_loaded()
    const unsub = live_entry_data.subscribe((entries_data) => {
      if (entries_data?.length) set(entries_data)
    })
    return () => {
      unsub()
    }
  }

  async function set_cache_if_comes_before_loaded() {
    const cached = await load_cache(dictionary_id)
    if (cached) {
      const _loading = get(loading)
      if (_loading)
        set(cached)
    }
  }

  const store_error = derived([
    entries.error,
    senses.error,
    audios.error,
    speakers.error,
    audio_speakers.error,
    tags.error,
    entry_tags.error,
    dialects.error,
    entry_dialects.error,
    photos.error,
    sense_photos.error,
    videos.error,
    video_speakers.error,
    sense_videos.error,
    sentences.error,
    senses_in_sentences.error,
  ], ([
    $entries_error,
    $senses_error,
    $audios_error,
    $speakers_error,
    $audio_speakers_error,
    $tags_error,
    $entry_tags_error,
    $dialects_error,
    $entry_dialects_error,
    $photos_error,
    $sense_photos_error,
    $videos_error,
    $video_speakers_error,
    $sense_videos_error,
    $sentences_error,
    $senses_in_sentences_error,
  ]) => {
    return $entries_error || $senses_error || $audios_error || $speakers_error
      || $audio_speakers_error || $tags_error || $entry_tags_error || $dialects_error
      || $entry_dialects_error || $photos_error || $sense_photos_error || $videos_error
      || $video_speakers_error || $sense_videos_error || $sentences_error || $senses_in_sentences_error
  }, null)

  async function reset_caches() {
    await Promise.all([
      entries.reset(),
      senses.reset(),
      audios.reset(),
      speakers.reset(),
      audio_speakers.reset(),
      tags.reset(),
      entry_tags.reset(),
      dialects.reset(),
      entry_dialects.reset(),
      photos.reset(),
      sense_photos.reset(),
      videos.reset(),
      video_speakers.reset(),
      sense_videos.reset(),
      sentences.reset(),
      senses_in_sentences.reset(),
    ])
  }

  return {
    subscribe,
    loading,
    error: store_error,
    reset_caches,
    entries,
    senses,
    audios,
    speakers,
    audio_speakers,
    tags,
    entry_tags,
    dialects,
    entry_dialects,
    photos,
    sense_photos,
    videos,
    video_speakers,
    sense_videos,
    sentences,
    senses_in_sentences,
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
