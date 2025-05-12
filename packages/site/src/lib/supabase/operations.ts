import { type Writable, get } from 'svelte/store'
import type { MultiString, TablesInsert, TablesUpdate } from '@living-dictionaries/types'
import type { Supabase } from '.'
import { page } from '$app/stores'
import { goto } from '$app/navigation'

function randomUUID() {
  return window.crypto.randomUUID()
}
async function get_pieces() {
  const { params: { entryId: entry_id_from_url }, state: { entry_id: entry_id_from_state }, data: { dictionary, supabase, entries_data } } = get(page) as any as { params: { entryId: string }, state: { entry_id: string }, data: { dictionary: { id: string }, supabase: Supabase, entries_data: { loading: Writable<boolean> } } }
  const { api } = await import('$lib/search/expose-entry-worker')
  const loading = get(entries_data.loading)
  if (loading) {
    alert('Wait until loading spinner stops to make edits.')
    throw new Error('db operations not ready yet')
  }

  return { api, dictionary_id: dictionary.id, entry_id_from_page: entry_id_from_url || entry_id_from_state, supabase }
}

export async function insert_entry(lexeme: MultiString) {
  try {
    const { dictionary_id, api, supabase } = await get_pieces()
    const entry_id = randomUUID()
    const entry = {
      id: entry_id,
      dictionary_id,
      lexeme,
    }
    await api.insert_entry(entry)
    const sense = {
      id: randomUUID(),
      entry_id,
      dictionary_id,
    }
    await api.insert_sense(sense)

    goto(`/${dictionary_id}/entry/${entry_id}`)

    const { error } = await supabase.from('entries').insert(entry)
    if (error)
      throw new Error(error.message)
    const { error: sense_error } = await supabase.from('senses').insert(sense)
    if (sense_error)
      throw new Error(sense_error.message)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_entry(entry: TablesUpdate<'entries'>) {
  try {
    const { entry_id_from_page, api, supabase } = await get_pieces()
    const id = entry.id || entry_id_from_page
    await api.update_entry({
      id,
      ...entry,
    })
    const { error } = await supabase.from('entries').update(entry).eq('id', id)
    if (error)
      throw new Error(error.message)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_sense(entry_id: string) {
  try {
    const { dictionary_id, api, supabase } = await get_pieces()
    const sense = {
      id: randomUUID(),
      entry_id,
      dictionary_id,
    }
    await api.insert_sense(sense)

    const { error } = await supabase.from('senses').insert(sense)
    if (error)
      throw new Error(error.message)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_sense(sense: TablesUpdate<'senses'>) {
  try {
    const { api, supabase } = await get_pieces()
    await api.update_sense(sense)
    const { error } = await supabase.from('senses').update(sense).eq('id', sense.id)
    if (error)
      throw new Error(error.message)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_sentence({ sentence, sense_id }: {
  sentence: TablesUpdate<'sentences'>
  sense_id: string
}) {
  try {
    const { dictionary_id, api, supabase } = await get_pieces()
    const new_sentence = {
      id: randomUUID(),
      dictionary_id,
      ...sentence,
    }
    await api.insert_sentence(new_sentence, sense_id)

    const { data, error } = await supabase.from('sentences').insert(new_sentence).select().single()
    if (error)
      throw new Error(error.message)

    const { error: sense_in_sentence_error } = await supabase.from('senses_in_sentences').upsert({
      sentence_id: new_sentence.id,
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
    const { api, supabase } = await get_pieces()
    await api.update_sentence(sentence)
    const { data, error } = await supabase.from('sentences').update(sentence).eq('id', sentence.id).select().single()
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
    const { dictionary_id, api, supabase } = await get_pieces()
    const audio = {
      dictionary_id,
      entry_id,
      id: randomUUID(),
      storage_path,
    }
    await api.insert_audio(audio)
    const { data, error } = await supabase.from('audio').insert(audio).select().single()
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
    const { api, supabase } = await get_pieces()
    await api.update_audio(audio)
    const { data, error } = await supabase.from('audio').update(audio).eq('id', audio.id).select().single()
    if (error)
      throw new Error(error.message)

    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_speaker(_speaker: Omit<TablesInsert<'speakers'>, 'dictionary_id'>) {
  try {
    const { dictionary_id, api, supabase } = await get_pieces()
    const speaker = {
      id: randomUUID(),
      dictionary_id,
      ..._speaker,
    }
    await api.insert_speaker(speaker)
    const { data, error } = await supabase.from('speakers').insert(speaker).select().single()
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
    const { dictionary_id, api, supabase } = await get_pieces()
    if (media === 'audio') {
      if (remove) {
        const audio_speaker = {
          speaker_id,
          audio_id: media_id,
          deleted: new Date().toISOString(),
        }
        await api.delete_audio_speaker(audio_speaker)
        const { error: delete_error } = await supabase.from('audio_speakers').update(audio_speaker)
          .eq('audio_id', media_id).eq('speaker_id', speaker_id)
        if (delete_error)
          throw new Error(delete_error.message)
      } else {
        const audio_speaker = {
          dictionary_id,
          speaker_id,
          audio_id: media_id,
          // to handle upsert over previously deleted connection
          deleted: null,
          created_at: new Date().toISOString(),
        }
        await api.insert_audio_speaker(audio_speaker)
        const { data, error } = await supabase.from('audio_speakers').upsert(audio_speaker).select().single()
        if (error)
          throw new Error(error.message)
        return data
      }
    } else if (media === 'video') {
      if (remove) {
        const video_speaker = {
          speaker_id,
          video_id: media_id,
          deleted: new Date().toISOString(),
        }
        await api.delete_video_speaker(video_speaker)
        const { error: delete_error } = await supabase.from('video_speakers').update(video_speaker)
          .eq('video_id', media_id).eq('speaker_id', speaker_id)
        if (delete_error)
          throw new Error(delete_error.message)
      } else {
        const video_speaker = {
          dictionary_id,
          speaker_id,
          video_id: media_id,
          // to handle upsert over previously deleted connection
          deleted: null,
          created_at: new Date().toISOString(),
        }
        await api.insert_video_speaker(video_speaker)
        const { data, error } = await supabase.from('video_speakers').upsert(video_speaker).select().single()
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
    const { dictionary_id, api, supabase } = await get_pieces()
    const tag = {
      dictionary_id,
      id: randomUUID(),
      name,
    }
    await api.insert_tag(tag)
    const { data, error } = await supabase.from('tags').insert(tag).select().single()
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
    const { dictionary_id, api, supabase } = await get_pieces()
    if (remove) {
      const entry_tag = {
        tag_id,
        entry_id,
        deleted: new Date().toISOString(),
      }
      await api.delete_entry_tag(entry_tag)
      const { error: delete_error } = await supabase.from('entry_tags').update(entry_tag)
        .eq('tag_id', tag_id).eq('entry_id', entry_id)
      if (delete_error)
        throw new Error(delete_error.message)
    } else {
      const entry_tag = {
        dictionary_id,
        tag_id,
        entry_id,
        // to handle upsert over previously deleted connection
        deleted: null,
        created_at: new Date().toISOString(),
      }
      await api.insert_entry_tag(entry_tag)
      const { data, error } = await supabase.from('entry_tags').upsert(entry_tag).select().single()
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
    const { dictionary_id, api, supabase } = await get_pieces()
    const dialect = {
      dictionary_id,
      id: randomUUID(),
      name,
    }
    await api.insert_dialect(dialect)
    const { data, error } = await supabase.from('dialects').insert(dialect).select().single()
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
    const { dictionary_id, api, supabase } = await get_pieces()
    if (remove) {
      const entry_dialect = {
        dialect_id,
        entry_id,
        deleted: new Date().toISOString(),
      }
      await api.delete_entry_dialect(entry_dialect)
      const { error: delete_error } = await supabase.from('entry_dialects').update(entry_dialect)
        .eq('dialect_id', dialect_id).eq('entry_id', entry_id)
      if (delete_error)
        throw new Error(delete_error.message)
    } else {
      const entry_dialect = {
        dictionary_id,
        dialect_id,
        entry_id,
        // to handle upsert over previously deleted connection
        deleted: null,
        created_at: new Date().toISOString(),
      }
      await api.insert_entry_dialect(entry_dialect)
      const { data, error } = await supabase.from('entry_dialects').upsert(entry_dialect).select().single()
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
  photo: _photo,
  sense_id,
}: {
  photo: Omit<TablesInsert<'photos'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id'>
  sense_id: string
}) {
  try {
    const { dictionary_id, api, supabase } = await get_pieces()
    const photo = {
      dictionary_id,
      id: randomUUID(),
      ..._photo,
    }
    await api.insert_photo(photo, sense_id)
    const { data, error } = await supabase.from('photos').insert(photo).select().single()
    if (error)
      throw new Error(error.message)

    const { error: sense_error } = await supabase.from('sense_photos').upsert({
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
    const { api, supabase } = await get_pieces()
    await api.update_photo(photo)
    const { data, error } = await supabase.from('photos').update(photo).eq('id', photo.id).select().single()
    if (error)
      throw new Error(error.message)

    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_video({
  video: _video,
  sense_id,
}: {
  video: TablesUpdate<'videos'>
  sense_id: string
}) {
  try {
    const { dictionary_id, api, supabase } = await get_pieces()
    const video = {
      dictionary_id,
      id: randomUUID(),
      ..._video,
    }
    await api.insert_video(video, sense_id)
    const { data, error } = await supabase.from('videos').insert(video).select().single()
    if (error)
      throw new Error(error.message)

    const { error: sense_error } = await supabase.from('sense_videos').upsert({
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
    const { api, supabase } = await get_pieces()
    await api.update_video(video)
    const { data, error } = await supabase.from('videos').update(video).eq('id', video.id).select().single()
    if (error)
      throw new Error(error.message)

    return data
  } catch (err) {
    alert(err)
    console.error(err)
  }
}
