import { derived } from 'svelte/store'
import type { EntryData } from '@living-dictionaries/types'
import { cached_data_store, cached_join_store } from './cached-data'
import type { Supabase } from '.'

export function create_entries_data_store({
  dictionary_id,
  supabase,
  log = false,
}: {
  dictionary_id: string
  supabase: Supabase
  log?: boolean
}) {
  const entries = cached_data_store({ table: 'entries', include: ['coordinates', 'elicitation_id', 'interlinearization', 'lexeme', 'morphology', 'notes', 'phonetic', 'scientific_names', 'sources'], dictionary_id, supabase, log })
  const senses = cached_data_store({ table: 'senses', include: ['entry_id', 'definition', 'glosses', 'noun_class', 'parts_of_speech', 'plural_form', 'semantic_domains', 'variant', 'write_in_semantic_domains'], dictionary_id, supabase, log })
  const audios = cached_data_store({ table: 'audio', include: ['entry_id', 'source', 'storage_path'], dictionary_id, supabase, log })
  const speakers = cached_data_store({ table: 'speakers', include: ['birthplace', 'decade', 'gender', 'name'], dictionary_id, supabase })
  const audio_speakers = cached_join_store({ table: 'audio_speakers', id_field_1: 'audio_id', id_field_2: 'speaker_id', dictionary_id, supabase, log })
  const tags = cached_data_store({ table: 'tags', include: ['name'], dictionary_id, supabase })
  const entry_tags = cached_join_store({ table: 'entry_tags', id_field_1: 'entry_id', id_field_2: 'tag_id', dictionary_id, supabase })
  const dialects = cached_data_store({ table: 'dialects', include: ['name'], dictionary_id, supabase })
  const entry_dialects = cached_join_store({ table: 'entry_dialects', id_field_1: 'entry_id', id_field_2: 'dialect_id', dictionary_id, supabase })
  const photos = cached_data_store({ table: 'photos', include: ['photographer', 'storage_path', 'serving_url', 'source'], dictionary_id, supabase })
  const sense_photos = cached_join_store({ table: 'sense_photos', id_field_1: 'sense_id', id_field_2: 'photo_id', dictionary_id, supabase })
  const videos = cached_data_store({ table: 'videos', include: ['hosted_elsewhere', 'source', 'storage_path', 'videographer'], dictionary_id, supabase })
  const video_speakers = cached_join_store({ table: 'video_speakers', id_field_1: 'video_id', id_field_2: 'speaker_id', dictionary_id, supabase, log })
  const sense_videos = cached_join_store({ table: 'sense_videos', id_field_1: 'sense_id', id_field_2: 'video_id', dictionary_id, supabase })
  const sentences = cached_data_store({ table: 'sentences', include: ['text', 'translation'], dictionary_id, supabase })
  const senses_in_sentences = cached_join_store({ table: 'senses_in_sentences', id_field_1: 'sense_id', id_field_2: 'sentence_id', dictionary_id, supabase })

  const connected_entries_data = derived([entries, senses, audios, speakers, audio_speakers, tags, entry_tags, dialects, entry_dialects, photos, sense_photos, videos, video_speakers, sense_videos, sentences, senses_in_sentences,
  ], ([$entries, $senses, $audios, $speakers, $audio_speakers, $tags, $entry_tags, $dialects, $entry_dialects, $photos, $sense_photos, $videos, $video_speakers, $sense_videos, $sentences, $senses_in_sentences,
  ]) => {
    if (log) console.info({ entries: $entries.length, senses: $senses.length, audio: $audios.length, speakers: $speakers.length, audio_speakers: $audio_speakers.length, tags: $tags.length, entry_tags: $entry_tags.length, dialects: $dialects.length, entry_dialects: $entry_dialects.length, photos: $photos.length, sense_photos: $sense_photos.length, videos: $videos.length, video_speakers: $video_speakers.length, sense_videos: $sense_videos.length, sentences: $sentences.length, senses_in_sentences: $senses_in_sentences.length })

    return $entries.map((entry) => {
      const senses_for_entry = $senses.filter(sense => sense.entry_id === entry.id)
        .map((sense) => {
          const sentence_ids = $senses_in_sentences.filter(sense_in_sentence => sense_in_sentence.sense_id === sense.id).map(sense_in_sentence => sense_in_sentence.sentence_id)
          const sentences_for_sense = $sentences.filter(sentence => sentence_ids.includes(sentence.id))
          const photo_ids = $sense_photos.filter(sense_photo => sense_photo.sense_id === sense.id).map(sense_photo => sense_photo.photo_id)
          const photos_for_sense = $photos.filter(photo => photo_ids.includes(photo.id))
          const video_ids = $sense_videos.filter(sense_video => sense_video.sense_id === sense.id).map(sense_video => sense_video.video_id)
          const videos_for_sense = $videos.filter(video => video_ids.includes(video.id))
            .map((video) => {
              const speaker_ids = $video_speakers
                .filter(vs => vs.video_id === video.id)
                .map(vs => vs.speaker_id)
              const speakers_for_video = $speakers.filter(speaker => speaker_ids.includes(speaker.id))

              return {
                ...video,
                ...(speakers_for_video.length ? { speakers: speakers_for_video } : {}),
              }
            })

          const { entry_id, ...sense_to_include } = sense
          return {
            ...sense_to_include,
            ...(sentences_for_sense.length ? { sentences: sentences_for_sense } : {}),
            ...(photos_for_sense.length ? { photos: photos_for_sense } : {}),
            ...(videos_for_sense.length ? { videos: videos_for_sense } : {}),
          }
        })
      const audios_for_entry = $audios.filter(audio => audio.entry_id === entry.id)
        .map((audio) => {
          const speaker_ids = $audio_speakers
            .filter(as => as.audio_id === audio.id)
            .map(as => as.speaker_id)
          const speakers_for_audio = $speakers.filter(speaker => speaker_ids.includes(speaker.id))

          return {
            ...audio,
            ...(speakers_for_audio.length ? { speakers: speakers_for_audio } : {}),
          }
        })

      const tag_ids = $entry_tags.filter(entry_tag => entry_tag.entry_id === entry.id).map(entry_tag => entry_tag.tag_id)
      const tags_for_entry = $tags.filter(tag => tag_ids.includes(tag.id))
      const dialect_ids = $entry_dialects.filter(entry_dialect => entry_dialect.entry_id === entry.id).map(entry_dialect => entry_dialect.dialect_id)
      const dialects_for_entry = $dialects.filter(dialect => dialect_ids.includes(dialect.id))

      const { id, deleted, dictionary_id, created_at, created_by, updated_by, updated_at, ...main } = entry

      return {
        id,
        main,
        updated_at,
        senses: senses_for_entry,
        ...(audios_for_entry.length ? { audios: audios_for_entry } : {}),
        ...(tags_for_entry.length ? { tags: tags_for_entry } : {}),
        ...(dialects_for_entry.length ? { dialects: dialects_for_entry } : {}),
        ...(deleted ? { deleted } : {}),
      } satisfies EntryData
    })
  }, [])

  const loading = derived([
    entries.loading,
    senses.loading,
    audios.loading,
    speakers.loading,
    audio_speakers.loading,
    tags.loading,
    entry_tags.loading,
    dialects.loading,
    entry_dialects.loading,
    photos.loading,
    sense_photos.loading,
    videos.loading,
    video_speakers.loading,
    sense_videos.loading,
    sentences.loading,
    senses_in_sentences.loading,
  ], ([
    $entries_loading,
    $senses_loading,
    $audios_loading,
    $speakers_loading,
    $audio_speakers_loading,
    $tags_loading,
    $entry_tags_loading,
    $dialects_loading,
    $entry_dialects_loading,
    $photos_loading,
    $sense_photos_loading,
    $videos_loading,
    $video_speakers_loading,
    $sense_videos_loading,
    $sentences_loading,
    $senses_in_sentences_loading,
  ]) => {
    if (log) {
      console.info({
        entries_loading: $entries_loading,
        senses_loading: $senses_loading,
        audio_loading: $audios_loading,
        speakers_loading: $speakers_loading,
        audio_speakers_loading: $audio_speakers_loading,
        tags_loading: $tags_loading,
        entry_tags_loading: $entry_tags_loading,
        dialects_loading: $dialects_loading,
        entry_dialects_loading: $entry_dialects_loading,
        photos_loading: $photos_loading,
        sense_photos_loading: $sense_photos_loading,
        videos_loading: $videos_loading,
        video_speakers_loading: $video_speakers_loading,
        sense_videos_loading: $sense_videos_loading,
        sentences_loading: $sentences_loading,
        senses_in_sentences_loading: $senses_in_sentences_loading,
      })
    }
    return $entries_loading || $senses_loading || $audios_loading || $speakers_loading
      || $audio_speakers_loading || $tags_loading || $entry_tags_loading || $dialects_loading
      || $entry_dialects_loading || $photos_loading || $sense_photos_loading || $videos_loading
      || $video_speakers_loading || $sense_videos_loading || $sentences_loading || $senses_in_sentences_loading
  }, true)

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
    subscribe: connected_entries_data.subscribe,
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

// async function load_cache(dictionary_id: string) {
//   const url = `https://cache.livingdictionaries.app/entries_data/${dictionary_id}.json`
//   try {
//     console.info('loading cached entries_data')
//     const response = await fetch(url)
//     if (!response.ok) {
//       console.info('cached entries_data not found')
//       return
//     }
//     const serialized_json = await response.text()
//     console.info('got cached entries_data')
//     const deserialized = JSON.parse(serialized_json)
//     console.info('parsed cached entries_data')
//   } catch (err) {
//     console.error('Error loading cached index', err)
//   }
// }
