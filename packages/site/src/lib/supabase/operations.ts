import { get } from 'svelte/store'
import type { MultiString, TablesInsert, TablesUpdate } from '@living-dictionaries/types'
import { page } from '$app/stores'
import { goto } from '$app/navigation'

function randomUUID() {
  return window.crypto.randomUUID()
}
function get_pieces() {
  const { params: { entryId: entry_id_from_url }, state: { entry_id: entry_id_from_state }, data: { entries_data, dictionary } } = get(page)
  return { dictionary_id: dictionary.id, entry_id_from_url: entry_id_from_url || entry_id_from_state, entries_data }
}

export async function insert_entry(lexeme: MultiString) {
  try {
    const { dictionary_id, entries_data } = get_pieces()
    const { data, error } = await entries_data.entries.insert({
      id: randomUUID(),
      dictionary_id,
      lexeme,
    })
    if (error)
      throw new Error(error.message)

    goto(`/${dictionary_id}/entry/${data.id}`)

    const { error: sense_error } = await entries_data.senses.insert({
      id: randomUUID(),
      entry_id: data.id,
      dictionary_id,
    })
    if (sense_error)
      throw new Error(sense_error.message)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_entry(entry: TablesUpdate<'entries'>) {
  try {
    const { entry_id_from_url, entries_data } = get_pieces()
    const { error } = await entries_data.entries.update({
      id: entry.id || entry_id_from_url,
      ...entry,
    })
    if (error)
      throw new Error(error.message)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_sense(entry_id: string) {
  try {
    const { dictionary_id, entries_data } = get_pieces()
    const { error } = await entries_data.senses.insert({
      id: randomUUID(),
      dictionary_id,
      entry_id,
    })

    if (error)
      throw new Error(error.message)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_sense(sense: TablesUpdate<'senses'>) {
  try {
    const { entries_data } = get_pieces()
    const { error } = await entries_data.senses.update(sense)
    if (error)
      throw new Error(error.message)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_sentence({
  sentence,
  sense_id,
}: {
  sentence: TablesUpdate<'sentences'>
  sense_id: string
}) {
  try {
    const { dictionary_id, entries_data } = get_pieces()
    const { data, error } = await entries_data.sentences.insert({
      id: randomUUID(),
      dictionary_id,
      ...sentence,
    })
    if (error)
      throw new Error(error.message)

    const { error: sense_in_sentence_error } = await entries_data.senses_in_sentences.insert({
      sentence_id: data.id,
      sense_id,
      dictionary_id,
    })
    if (sense_in_sentence_error)
      throw new Error(sense_in_sentence_error.message)
    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_sentence(sentence: TablesUpdate<'sentences'>) {
  try {
    const { entries_data } = get_pieces()
    const { data, error } = await entries_data.sentences.update(sentence)
    if (error)
      throw new Error(error.message)
    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_audio({
  storage_path,
  entry_id,
}: {
  storage_path: string
  entry_id: string
}) {
  try {
    const { dictionary_id, entries_data } = get_pieces()
    const { data, error } = await entries_data.audios.insert({
      dictionary_id,
      entry_id,
      id: randomUUID(),
      storage_path,
    })
    if (error)
      throw new Error(error.message)

    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_audio(audio: TablesUpdate<'audio'>) {
  try {
    const { entries_data } = get_pieces()
    const { data, error } = await entries_data.audios.update(audio)
    if (error)
      throw new Error(error.message)

    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_speaker(speaker: Omit<TablesInsert<'speakers'>, 'dictionary_id'>) {
  try {
    const { dictionary_id, entries_data } = get_pieces()
    const { data, error } = await entries_data.speakers.insert({
      id: randomUUID(),
      dictionary_id,
      ...speaker,
    })
    if (error)
      throw new Error(error.message)

    return data
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
    const { dictionary_id, entries_data } = get_pieces()
    if (media === 'audio') {
      if (remove) {
        const { error: delete_error } = await entries_data.audio_speakers.update({
          speaker_id,
          audio_id: media_id,
          deleted: new Date().toISOString(),
        })
        if (delete_error)
          throw new Error(delete_error.message)
      } else {
        const { data, error } = await entries_data.audio_speakers.insert({
          dictionary_id,
          speaker_id,
          audio_id: media_id,
        })
        if (error)
          throw new Error(error.message)
        return data
      }
    } else if (media === 'video') {
      if (remove) {
        const { error: delete_error } = await entries_data.video_speakers.update({
          speaker_id,
          video_id: media_id,
          deleted: new Date().toISOString(),
        })
        if (delete_error)
          throw new Error(delete_error.message)
      } else {
        const { data, error } = await entries_data.video_speakers.insert({
          dictionary_id,
          speaker_id,
          video_id: media_id,
        })
        if (error)
          throw new Error(error.message)
        return data
      }
    }
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_tag({ name }: { name: string }) {
  try {
    const { dictionary_id, entries_data } = get_pieces()
    const { data, error } = await entries_data.tags.insert({
      dictionary_id,
      id: randomUUID(),
      name,
    })
    if (error)
      throw new Error(error.message)

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
    const { dictionary_id, entries_data } = get_pieces()
    if (remove) {
      const { error: delete_error } = await entries_data.entry_tags.update({
        tag_id,
        entry_id,
        deleted: new Date().toISOString(),
      })
      if (delete_error)
        throw new Error(delete_error.message)
    } else {
      const { data, error } = await entries_data.entry_tags.insert({
        dictionary_id,
        tag_id,
        entry_id,
      })
      if (error)
        throw new Error(error.message)
      return data
    }
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_dialect({ name }: { name: MultiString }) {
  try {
    const { dictionary_id, entries_data } = get_pieces()
    const { data, error } = await entries_data.dialects.insert({
      dictionary_id,
      id: randomUUID(),
      name,
    })
    if (error)
      throw new Error(error.message)

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
    const { dictionary_id, entries_data } = get_pieces()
    if (remove) {
      const { error: delete_error } = await entries_data.entry_dialects.update({
        dialect_id,
        entry_id,
        deleted: new Date().toISOString(),
      })
      if (delete_error)
        throw new Error(delete_error.message)
    } else {
      const { data, error } = await entries_data.entry_dialects.insert({
        dictionary_id,
        dialect_id,
        entry_id,
      })
      if (error)
        throw new Error(error.message)
      return data
    }
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_photo({
  photo,
  sense_id,
}: {
  photo: Omit<TablesInsert<'photos'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id'>
  sense_id: string
}) {
  try {
    const { dictionary_id, entries_data } = get_pieces()
    const { data, error } = await entries_data.photos.insert({
      dictionary_id,
      id: randomUUID(),
      ...photo,
    })
    if (error)
      throw new Error(error.message)

    const { error: sense_error } = await entries_data.sense_photos.insert({
      photo_id: data.id,
      sense_id,
      dictionary_id,
    })
    if (sense_error)
      throw new Error(sense_error.message)
    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_photo(photo: TablesUpdate<'photos'>) {
  try {
    const { entries_data } = get_pieces()
    const { data, error } = await entries_data.photos.update(photo)
    if (error)
      throw new Error(error.message)

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
    const { dictionary_id, entries_data } = get_pieces()
    const { data, error } = await entries_data.videos.insert({
      dictionary_id,
      id: randomUUID(),
      ...video,
    })
    if (error)
      throw new Error(error.message)

    const { error: sense_error } = await entries_data.sense_videos.insert({
      video_id: data.id,
      sense_id,
      dictionary_id,
    })
    if (sense_error)
      throw new Error(sense_error.message)

    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_video(video: TablesUpdate<'videos'>) {
  try {
    const { entries_data } = get_pieces()
    const { data, error } = await entries_data.videos.update(video)
    if (error)
      throw new Error(error.message)

    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}
