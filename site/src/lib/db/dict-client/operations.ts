import { get } from 'svelte/store'
import type { Writable } from 'svelte/store'
import type { MultiString } from '$lib/types'
import type { DictInsertType, DictLiveDb, DictUpdateType } from '$lib/db/dict-client/dict-live-db.svelte'
import { page } from '$app/state'
import { goto } from '$app/navigation'

// vps-migration M4 write/sync: persistence is the browser wa-sqlite per-dict DB
// (`dict_db`). Single-row ops go through the `dict_db` table accessors; the
// multi-table groups (entry+sense, sentence+junction, media+junction) and
// junction link/unlink go through `dict_db.writes` — ONE atomic `dict_write`
// RPC each, run by the leader worker inside BEGIN/COMMIT under the op-mutex
// (see `dict-writes.ts`). The sync engine pushes dirty rows to the server,
// which re-checks the caller's role. The Orama search index + entry-view store
// are kept in sync by the watch-based feed (`orama-watcher.ts` → worker
// `apply_rows`), which reindexes changed rows for BOTH these local writes AND
// remote sync-pulls. Per-dict rows carry NO `dictionary_id` (single-dict file)
// and REQUIRE `created_by_user_id` / `updated_by_user_id` (NOT NULL) — those
// (plus `id` / `created_at` / `updated_at` / `dirty`) are auto-stamped from
// the editing user set in the layout (see `create_dict_live_db({ user_id })`),
// which is why the params below omit them. This layer stays only for genuinely
// multi-table orchestration and junction link/unlink; single-row scalar field
// edits mutate the live row + `_save()`.

function get_pieces() {
  const { dictionary, dict_db, auth_user, entries_data } = page.data as unknown as {
    dictionary: { id: string }
    dict_db: DictLiveDb | null
    auth_user: { user: { id: string } | null }
    entries_data: { loading: Writable<boolean> }
  }
  const loading = get(entries_data.loading)
  if (loading) {
    alert('Wait until loading spinner stops to make edits.')
    throw new Error('db operations not ready yet')
  }
  if (!dict_db)
    throw new Error('Editing database is not ready yet')
  if (!auth_user.user?.id)
    throw new Error('You must be signed in to edit')

  const entry_id_from_page = page.params.entryId || (page.state as { entry_id?: string }).entry_id
  return { dictionary_id: dictionary.id, entry_id_from_page, dict_db }
}

export async function insert_entry(lexeme: MultiString) {
  try {
    const { dictionary_id, dict_db } = get_pieces()
    const entry = await dict_db.writes.insert_entry({ lexeme })
    goto(`/${dictionary_id}/entry/${entry.id}`)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function delete_entry(entry_id?: string) {
  try {
    const { entry_id_from_page, dict_db } = get_pieces()
    await dict_db.entries.delete(entry_id || entry_id_from_page)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_sense(entry_id: string) {
  try {
    const { dict_db } = get_pieces()
    await dict_db.senses.insert({ entry_id })
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function delete_sense(sense_id: string) {
  try {
    const { dict_db } = get_pieces()
    await dict_db.senses.delete(sense_id)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_sentence({ sentence, sense_id }: {
  sentence: DictInsertType<'sentences'>
  sense_id: string
}) {
  try {
    const { dict_db } = get_pieces()
    return await dict_db.writes.insert_sentence({ sentence, sense_id })
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_sentence(sentence: DictUpdateType<'sentences'>) {
  try {
    const { dict_db } = get_pieces()
    await dict_db.sentences.update(sentence)
    return sentence
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function delete_sentence(sentence_id: string) {
  try {
    if (!confirm('Are you sure you want to delete this sentence?')) return

    const { dict_db } = get_pieces()
    await dict_db.sentences.delete(sentence_id)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_audio({
  storage_path,
  entry_id,
  speaker_id,
}: {
  storage_path: string
  entry_id: string
  speaker_id?: string
}) {
  try {
    const { dict_db } = get_pieces()
    return await dict_db.writes.insert_audio({ audio: { storage_path, entry_id }, speaker_id })
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_audio(audio: DictUpdateType<'audio'>) {
  try {
    const { dict_db } = get_pieces()
    await dict_db.audio.update(audio)
    return audio
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function delete_audio(audio_id: string) {
  try {
    const { dict_db } = get_pieces()
    await dict_db.audio.delete(audio_id)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_speaker(speaker: DictInsertType<'speakers'>) {
  try {
    const { dict_db } = get_pieces()
    const [new_speaker] = await dict_db.speakers.insert(speaker)
    return new_speaker
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
    const { dict_db } = get_pieces()
    const table = media === 'audio' ? 'audio_speakers' as const : 'video_speakers' as const
    const key = media === 'audio' ? { audio_id: media_id, speaker_id } : { video_id: media_id, speaker_id }
    if (remove)
      await dict_db.writes.unlink_junction({ table, key })
    else
      await dict_db.writes.link_junction({ table, key })
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_tag({ name }: { name: string }) {
  try {
    const { dict_db } = get_pieces()
    const [tag] = await dict_db.tags.insert({ name })
    return tag
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
    const { dict_db } = get_pieces()
    const key = { entry_id, tag_id }
    if (remove)
      await dict_db.writes.unlink_junction({ table: 'entry_tags', key })
    else
      await dict_db.writes.link_junction({ table: 'entry_tags', key })
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_dialect({ name }: { name: MultiString }) {
  try {
    const { dict_db } = get_pieces()
    const [dialect] = await dict_db.dialects.insert({ name })
    return dialect
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
    const { dict_db } = get_pieces()
    const key = { entry_id, dialect_id }
    if (remove)
      await dict_db.writes.unlink_junction({ table: 'entry_dialects', key })
    else
      await dict_db.writes.link_junction({ table: 'entry_dialects', key })
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_photo({
  photo,
  sense_id,
}: {
  photo: DictInsertType<'photos'>
  sense_id: string
}) {
  try {
    const { dict_db } = get_pieces()
    return await dict_db.writes.insert_photo({ photo, sense_id })
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_photo(photo: DictUpdateType<'photos'>) {
  try {
    const { dict_db } = get_pieces()
    await dict_db.photos.update(photo)
    return photo
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function delete_photo(photo_id: string) {
  try {
    const { dict_db } = get_pieces()
    await dict_db.photos.delete(photo_id)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_video({
  video,
  sense_id,
  speaker_id,
}: {
  video: DictInsertType<'videos'>
  sense_id: string
  speaker_id?: string
}) {
  try {
    const { dict_db } = get_pieces()
    return await dict_db.writes.insert_video({ video, sense_id, speaker_id })
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_video(video: DictUpdateType<'videos'>) {
  try {
    const { dict_db } = get_pieces()
    await dict_db.videos.update(video)
    return video
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function delete_video(video_id: string) {
  try {
    const { dict_db } = get_pieces()
    await dict_db.videos.delete(video_id)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}
