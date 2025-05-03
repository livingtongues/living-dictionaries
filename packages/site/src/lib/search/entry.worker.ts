import { expose } from 'comlink'
import type { EntryData } from '@living-dictionaries/types'

function process_entries({ $entries, $senses, $audios, $speakers, $audio_speakers, $tags, $entry_tags, $dialects, $entry_dialects, $photos, $sense_photos, $videos, $video_speakers, $sense_videos, $sentences, $senses_in_sentences }) {
  console.time('Process Entries Time')
  const entries_data = $entries.map((entry) => {
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
  console.timeEnd('Process Entries Time')
  return entries_data
}

export const api = {
  process_entries,
}

expose(api)
