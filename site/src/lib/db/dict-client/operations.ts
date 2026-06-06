import { get } from 'svelte/store'
import type { Writable } from 'svelte/store'
import type { MultiString } from '$lib/types'
import type { DictInsertType, DictLiveDb, DictUpdateType } from '$lib/db/dict-client/dict-live-db.svelte'
import { page } from '$app/state'
import { goto } from '$app/navigation'

// vps-migration M4 write/sync: persistence is the browser wa-sqlite per-dict DB
// (`dict_db`). Each op writes ONLY to `dict_db` (the SharedWorker sync engine
// pushes dirty rows to the server, which re-checks the caller's role). The
// Orama search index + entry-view store are kept in sync by the watch-based
// feed (`orama-watcher.ts` → worker `apply_rows`), which reindexes changed rows
// for BOTH these local writes AND remote sync-pulls — so there is NO direct
// Orama double-write here anymore (P4b). Per-dict rows carry NO `dictionary_id`
// (single-dict file) and REQUIRE `created_by_user_id` / `updated_by_user_id`
// (NOT NULL) — those (plus `id` / `created_at` / `updated_at` / `dirty`) are
// auto-stamped by `dict_db` from the editing user set in the layout (see
// `create_dict_live_db({ user_id })`), which is why the `DictInsertType` params
// below omit them. This layer stays only for genuinely multi-table
// orchestration (entry+sense, sentence+junction, media+junction) and junction
// link/unlink; single-row scalar field edits mutate the live row + `_save()`.

function randomUUID() {
  return window.crypto.randomUUID()
}

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

/**
 * Add a junction link keyed by its natural key (no-op if it already exists).
 * Junctions have a synthetic id PK + UNIQUE on the natural key. Deletes are
 * hard now, so there's no soft-deleted row to revive — just insert if absent.
 */
async function link_junction({ dict_db, table, where, params, insert_row }: {
  dict_db: DictLiveDb
  table: string
  where: string
  params: unknown[]
  insert_row: Record<string, unknown>
}) {
  const existing = await (dict_db as any)[table].query({ where, params }).snapshot()
  if (!existing[0])
    await (dict_db as any)[table].insert({ ...insert_row })
}

/** Hard-delete a junction link (tombstone) keyed by its natural key. */
async function unlink_junction({ dict_db, table, where, params }: {
  dict_db: DictLiveDb
  table: string
  where: string
  params: unknown[]
}) {
  const existing = await (dict_db as any)[table].query({ where, params }).snapshot()
  if (existing[0])
    await (dict_db as any)[table].delete(existing[0].id)
}

export async function insert_entry(lexeme: MultiString) {
  try {
    const { dictionary_id, dict_db } = get_pieces()
    const entry_id = randomUUID()

    await dict_db.entries.insert({ id: entry_id, lexeme })
    await dict_db.senses.insert({ id: randomUUID(), entry_id })

    goto(`/${dictionary_id}/entry/${entry_id}`)
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
    await dict_db.senses.insert({ id: randomUUID(), entry_id })
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
    const new_sentence = { id: randomUUID(), ...sentence }
    await dict_db.sentences.insert(new_sentence)
    await dict_db.senses_in_sentences.insert({ sentence_id: new_sentence.id, sense_id })

    return new_sentence
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
}: {
  storage_path: string
  entry_id: string
}) {
  try {
    const { dict_db } = get_pieces()
    const audio = { id: randomUUID(), entry_id, storage_path }
    await dict_db.audio.insert(audio)
    return audio
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
    const new_speaker = { id: randomUUID(), ...speaker }
    await dict_db.speakers.insert(new_speaker)
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
    if (media === 'audio') {
      if (remove) {
        await unlink_junction({ dict_db, table: 'audio_speakers', where: 'audio_id = ? AND speaker_id = ?', params: [media_id, speaker_id] })
      } else {
        await link_junction({ dict_db, table: 'audio_speakers', where: 'audio_id = ? AND speaker_id = ?', params: [media_id, speaker_id], insert_row: { audio_id: media_id, speaker_id } })
      }
    } else if (media === 'video') {
      if (remove) {
        await unlink_junction({ dict_db, table: 'video_speakers', where: 'video_id = ? AND speaker_id = ?', params: [media_id, speaker_id] })
      } else {
        await link_junction({ dict_db, table: 'video_speakers', where: 'video_id = ? AND speaker_id = ?', params: [media_id, speaker_id], insert_row: { video_id: media_id, speaker_id } })
      }
    }
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_tag({ name }: { name: string }) {
  try {
    const { dict_db } = get_pieces()
    const tag = { id: randomUUID(), name }
    await dict_db.tags.insert(tag)
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
    if (remove) {
      await unlink_junction({ dict_db, table: 'entry_tags', where: 'entry_id = ? AND tag_id = ?', params: [entry_id, tag_id] })
    } else {
      await link_junction({ dict_db, table: 'entry_tags', where: 'entry_id = ? AND tag_id = ?', params: [entry_id, tag_id], insert_row: { entry_id, tag_id } })
    }
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_dialect({ name }: { name: MultiString }) {
  try {
    const { dict_db } = get_pieces()
    const dialect = { id: randomUUID(), name }
    await dict_db.dialects.insert(dialect)
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
    if (remove) {
      await unlink_junction({ dict_db, table: 'entry_dialects', where: 'entry_id = ? AND dialect_id = ?', params: [entry_id, dialect_id] })
    } else {
      await link_junction({ dict_db, table: 'entry_dialects', where: 'entry_id = ? AND dialect_id = ?', params: [entry_id, dialect_id], insert_row: { entry_id, dialect_id } })
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
  photo: DictInsertType<'photos'>
  sense_id: string
}) {
  try {
    const { dict_db } = get_pieces()
    const new_photo = { id: randomUUID(), ...photo }
    await dict_db.photos.insert(new_photo)
    await dict_db.sense_photos.insert({ photo_id: new_photo.id, sense_id })
    return new_photo
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
}: {
  video: DictInsertType<'videos'>
  sense_id: string
}) {
  try {
    const { dict_db } = get_pieces()
    const new_video = { id: randomUUID(), ...video }
    await dict_db.videos.insert(new_video)
    await dict_db.sense_videos.insert({ video_id: new_video.id, sense_id })
    return new_video
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
