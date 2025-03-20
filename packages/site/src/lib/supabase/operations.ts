import { get } from 'svelte/store'
import type { MultiString, TablesInsert, TablesUpdate } from '@living-dictionaries/types'
import { page } from '$app/stores'
import { goto, invalidate } from '$app/navigation'
import { ENTRY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations'
import { content_update } from '$api/db/content-update/_call'

function randomUUID() {
  return window.crypto.randomUUID()
}
function get_pieces() {
  const { params: { entryId: entry_id_from_url }, state: { entry_id: entry_id_from_state }, data: { entries, photos, videos, sentences, tags, dialects, speakers, dictionary } } = get(page)
  return { dictionary_id: dictionary.id, entry_id_from_url: entry_id_from_url || entry_id_from_state, refresh_entries: entries.refresh, refresh_photos: photos.refresh, refresh_videos: videos.refresh, refresh_sentences: sentences.refresh, refresh_dialects: dialects.refresh, refresh_speakers: speakers.refresh, refresh_tags: tags.refresh }
}

export async function insert_entry(lexeme: MultiString) {
  try {
    const { dictionary_id, refresh_entries } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      entry_id: randomUUID(),
      type: 'insert_entry',
      data: { lexeme },
    })
    if (error)
      throw new Error(error.message)

    await refresh_entries()
    const href = `/${dictionary_id}/entry/${data.entry_id}`
    goto(href)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_entry({
  entry,
  entry_id: entry_id_from_function,
}: {
  entry: TablesUpdate<'entries'>
  entry_id?: string
}) {
  try {
    const { dictionary_id, entry_id_from_url, refresh_entries } = get_pieces()
    const { error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      entry_id: entry_id_from_function || entry_id_from_url || randomUUID(),
      type: 'update_entry',
      data: entry,
    })
    if (error)
      throw new Error(error.message)

    await refresh_entries()
    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_sense({
  sense,
  entry_id,
  sense_id,
}: {
  sense: TablesUpdate<'senses'>
  entry_id: string
  sense_id?: string
}) {
  try {
    const { dictionary_id, refresh_entries } = get_pieces()

    const { error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      entry_id,
      sense_id,
      type: 'insert_sense',
      data: sense,
    })

    if (error)
      throw new Error(error.message)

    await refresh_entries()
    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_sense({
  sense,
  sense_id,
}: {
  sense: TablesUpdate<'senses'>
  sense_id: string
}) {
  try {
    const { dictionary_id, refresh_entries } = get_pieces()
    const { error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      sense_id,
      type: 'update_sense',
      data: sense,
    })
    if (error)
      throw new Error(error.message)

    await refresh_entries()
    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_sentence({
  sentence,
  sentence_id,
  sense_id,
}: {
  sentence: TablesUpdate<'sentences'>
  sentence_id?: string
  sense_id: string
}) {
  try {
    const { dictionary_id, refresh_entries, refresh_sentences } = get_pieces()
    const { data, error } = await content_update({

      update_id: randomUUID(),
      dictionary_id,
      sense_id,
      sentence_id: sentence_id || randomUUID(),
      type: 'insert_sentence',
      data: sentence,
    })
    if (error)
      throw new Error(error.message)

    await refresh_sentences()
    await refresh_entries()
    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_sentence({
  sentence,
  sentence_id,
}: {
  sentence: TablesUpdate<'sentences'>
  sentence_id: string
}) {
  try {
    const { dictionary_id, refresh_entries, refresh_sentences } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      sentence_id,
      type: 'update_sentence',
      data: sentence,
    })
    if (error)
      throw new Error(error.message)

    await refresh_sentences()
    await refresh_entries()
    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function upsert_audio({
  audio,
  audio_id,
  entry_id,
  refresh_entry,
}: {
  audio: TablesUpdate<'audio'>
  audio_id?: string
  entry_id?: string
  refresh_entry?: boolean
}) {
  try {
    const { dictionary_id, refresh_entries } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      entry_id,
      audio_id: audio_id || randomUUID(),
      type: 'upsert_audio',
      data: audio,
    })
    if (error)
      throw new Error(error.message)

    if (refresh_entry) {
      await refresh_entries()
      await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
    }
    return data.audio_id
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function upsert_speaker({
  speaker,
  speaker_id,
}: {
  speaker: TablesUpdate<'speakers'>
  speaker_id?: string
}) {
  try {
    const { dictionary_id, refresh_speakers } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      speaker_id: speaker_id || randomUUID(),
      type: 'upsert_speaker',
      data: speaker,
    })
    if (error)
      throw new Error(error.message)

    await refresh_speakers()
    return data.speaker_id
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function assign_speaker({
  speaker_id,
  media_id,
  media,
  remove,
}: {
  speaker_id: string
  media_id: string
  media: 'audio' | 'video'
  remove?: boolean
}) {
  try {
    const { dictionary_id, refresh_entries, refresh_videos } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      speaker_id,
      ...(media === 'audio' ? { audio_id: media_id } : { video_id: media_id }),
      ...(remove ? { data: { deleted: 'true' } } : { }),
      type: 'assign_speaker',
    })
    if (error)
      throw new Error(error.message)

    if (media === 'video') {
      await refresh_videos()
    }
    await refresh_entries()
    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)

    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_tag({
  tag,
  tag_id,
}: {
  tag: TablesUpdate<'tags'> & Pick<TablesInsert<'tags'>, 'name'>
  tag_id?: string
}) {
  try {
    const { dictionary_id, refresh_tags } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      tag_id: tag_id || randomUUID(),
      type: 'insert_tag',
      data: tag,
    })
    if (error)
      throw new Error(error.message)

    await refresh_tags()
    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function assign_tag({
  tag_id,
  entry_id,
  remove,
}: {
  tag_id: string
  entry_id: string
  remove?: boolean
}) {
  try {
    const { dictionary_id, refresh_entries } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      tag_id,
      entry_id,
      ...(remove ? { data: { deleted: 'true' } } : { }),
      type: 'assign_tag',
    })
    if (error)
      throw new Error(error.message)

    await refresh_entries()
    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)

    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_dialect({
  dialect,
  dialect_id,
}: {
  dialect: TablesUpdate<'dialects'> & Pick<TablesInsert<'dialects'>, 'name'>
  dialect_id?: string
}) {
  try {
    const { dictionary_id, refresh_dialects } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      dialect_id: dialect_id || randomUUID(),
      type: 'insert_dialect',
      data: dialect,
    })
    if (error)
      throw new Error(error.message)

    await refresh_dialects()
    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function assign_dialect({
  dialect_id,
  entry_id,
  remove,
}: {
  dialect_id: string
  entry_id: string
  remove?: boolean
}) {
  try {
    const { dictionary_id, refresh_entries } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      dialect_id,
      entry_id,
      ...(remove ? { data: { deleted: 'true' } } : { }),
      type: 'assign_dialect',
    })
    if (error)
      throw new Error(error.message)

    await refresh_entries()
    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)

    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_photo({
  photo,
  photo_id,
  sense_id,
}: {
  photo: Omit<TablesInsert<'photos'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id'>
  photo_id?: string
  sense_id: string
}) {
  try {
    const { dictionary_id, refresh_entries, refresh_photos } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      sense_id,
      photo_id: photo_id || randomUUID(),
      type: 'insert_photo',
      data: photo,
    })
    if (error)
      throw new Error(error.message)

    await refresh_photos()
    await refresh_entries()
    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_photo({
  photo,
  photo_id,
}: {
  photo: TablesUpdate<'photos'>
  photo_id: string
}) {
  try {
    const { dictionary_id, refresh_entries, refresh_photos } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      photo_id,
      type: 'update_photo',
      data: photo,
    })
    if (error)
      throw new Error(error.message)

    await refresh_photos()
    await refresh_entries()
    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_video({
  video,
  sense_id,
}: {
  video: TablesUpdate<'videos'>
  sense_id: string
}) {
  try {
    const { dictionary_id, refresh_entries, refresh_videos } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      sense_id,
      video_id: randomUUID(),
      type: 'insert_video',
      data: video,
    })
    if (error)
      throw new Error(error.message)

    await refresh_videos()
    await refresh_entries()
    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_video({
  video,
  video_id,
}: {
  video: TablesUpdate<'videos'>
  video_id: string
}) {
  try {
    const { dictionary_id, refresh_entries, refresh_videos } = get_pieces()
    const { data, error } = await content_update({
      update_id: randomUUID(),
      dictionary_id,
      video_id,
      type: 'update_video',
      data: video,
    })
    if (error)
      throw new Error(error.message)

    await refresh_videos()
    await refresh_entries()
    await invalidate(ENTRY_UPDATED_LOAD_TRIGGER)
    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}
