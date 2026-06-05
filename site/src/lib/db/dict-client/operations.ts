import { get } from 'svelte/store'
import type { Writable } from 'svelte/store'
import type { MultiString, SystemInsertFields, TablesInsert, TablesUpdate } from '$lib/types'
import type { DictLiveDb } from '$lib/db/dict-client/dict-live-db.svelte'
import { page } from '$app/stores'
import { goto } from '$app/navigation'

// vps-migration M4 write/sync: persistence is the browser wa-sqlite per-dict DB
// (`dict_db`). Each op writes ONLY to `dict_db` (the SharedWorker sync engine
// pushes dirty rows to the server, which re-checks the caller's role). The
// Orama search index + entry-view store are kept in sync by the watch-based
// feed (`orama-watcher.ts` → worker `apply_rows`), which reindexes changed rows
// for BOTH these local writes AND remote sync-pulls — so there is NO direct
// Orama double-write here anymore (P4b). Per-dict rows carry NO `dictionary_id`
// (single-dict file) and REQUIRE `created_by_user_id` / `updated_by_user_id`
// (NOT NULL).

function randomUUID() {
  return window.crypto.randomUUID()
}

function get_pieces() {
  const { params: { entryId: entry_id_from_url }, state: { entry_id: entry_id_from_state }, data: { dictionary, dict_db, auth_user, entries_data } } = get(page) as any as {
    params: { entryId: string }
    state: { entry_id: string }
    data: {
      dictionary: { id: string }
      dict_db: DictLiveDb | null
      auth_user: { user: { id: string } | null }
      entries_data: { loading: Writable<boolean> }
    }
  }
  const loading = get(entries_data.loading)
  if (loading) {
    alert('Wait until loading spinner stops to make edits.')
    throw new Error('db operations not ready yet')
  }
  if (!dict_db)
    throw new Error('Editing database is not ready yet')
  const user_id = auth_user.user?.id
  if (!user_id)
    throw new Error('You must be signed in to edit')

  return { dictionary_id: dictionary.id, entry_id_from_page: entry_id_from_url || entry_id_from_state, dict_db, user_id }
}

/** Strip columns that don't exist on / shouldn't be hand-set in the per-dict schema. */
function clean<T extends Record<string, any>>(row: T): T {
  const { dictionary_id, created_by, updated_by, ...rest } = row
  return rest as T
}

/**
 * Add a junction link (or revive a soft-deleted one) keyed by its natural key.
 * Junctions have a synthetic id PK + UNIQUE on the natural key.
 */
async function link_junction({ dict_db, table, where, params, insert_row, user_id }: {
  dict_db: DictLiveDb
  table: string
  where: string
  params: unknown[]
  insert_row: Record<string, unknown>
  user_id: string
}) {
  const existing = await (dict_db as any)[table].query({ where, params }).snapshot()
  if (existing[0]) {
    if (existing[0].deleted)
      await (dict_db as any)[table].update({ id: existing[0].id, deleted: null, updated_by_user_id: user_id })
  } else {
    await (dict_db as any)[table].insert({ ...insert_row, created_by_user_id: user_id, updated_by_user_id: user_id })
  }
}

/** Soft-delete a junction link (set `deleted`) keyed by its natural key. */
async function unlink_junction({ dict_db, table, where, params, user_id }: {
  dict_db: DictLiveDb
  table: string
  where: string
  params: unknown[]
  user_id: string
}) {
  const existing = await (dict_db as any)[table].query({ where, params }).snapshot()
  if (existing[0])
    await (dict_db as any)[table].update({ id: existing[0].id, deleted: new Date().toISOString(), updated_by_user_id: user_id })
}

export async function insert_entry(lexeme: MultiString) {
  try {
    const { dictionary_id, dict_db, user_id } = get_pieces()
    const audit = { created_by_user_id: user_id, updated_by_user_id: user_id }
    const entry_id = randomUUID()
    const entry = { id: entry_id, lexeme, ...audit }
    const sense = { id: randomUUID(), entry_id, ...audit }

    await dict_db.entries.insert(entry as never)
    await dict_db.senses.insert(sense as never)

    goto(`/${dictionary_id}/entry/${entry_id}`)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_entry(entry: TablesUpdate<'entries'>) {
  try {
    const { entry_id_from_page, dict_db, user_id } = get_pieces()
    const id = entry.id || entry_id_from_page
    await dict_db.entries.update({ ...clean(entry), id, updated_by_user_id: user_id } as never)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_sense(entry_id: string) {
  try {
    const { dict_db, user_id } = get_pieces()
    const sense = {
      id: randomUUID(),
      entry_id,
      created_by_user_id: user_id,
      updated_by_user_id: user_id,
    }
    await dict_db.senses.insert(sense as never)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_sense(sense: TablesUpdate<'senses'>) {
  try {
    const { dict_db, user_id } = get_pieces()
    await dict_db.senses.update({ ...clean(sense), updated_by_user_id: user_id } as never)
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
    const { dict_db, user_id } = get_pieces()
    const new_sentence = {
      id: randomUUID(),
      ...clean(sentence),
      created_by_user_id: user_id,
      updated_by_user_id: user_id,
    }
    await dict_db.sentences.insert(new_sentence as never)
    await dict_db.senses_in_sentences.insert({
      sentence_id: new_sentence.id,
      sense_id,
      created_by_user_id: user_id,
      updated_by_user_id: user_id,
    } as never)

    return new_sentence
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_sentence(sentence: TablesUpdate<'sentences'>) {
  try {
    const { dict_db, user_id } = get_pieces()
    await dict_db.sentences.update({ ...clean(sentence), updated_by_user_id: user_id } as never)
    return sentence
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function delete_sentence(sentence_id: string) {
  try {
    if (!confirm('Are you sure you want to delete this sentence?')) return

    const { dict_db, user_id } = get_pieces()
    await dict_db.sentences.update({ id: sentence_id, deleted: new Date().toISOString(), updated_by_user_id: user_id } as never)
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
    const { dict_db, user_id } = get_pieces()
    const audio = {
      entry_id,
      id: randomUUID(),
      storage_path,
      created_by_user_id: user_id,
      updated_by_user_id: user_id,
    }
    await dict_db.audio.insert(audio as never)
    return audio
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_audio(audio: TablesUpdate<'audio'>) {
  try {
    const { dict_db, user_id } = get_pieces()
    await dict_db.audio.update({ ...clean(audio), updated_by_user_id: user_id } as never)
    return audio
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_speaker(_speaker: Omit<TablesInsert<'speakers'>, SystemInsertFields>) {
  try {
    const { dict_db, user_id } = get_pieces()
    const speaker = {
      id: randomUUID(),
      ...clean(_speaker),
      created_by_user_id: user_id,
      updated_by_user_id: user_id,
    }
    await dict_db.speakers.insert(speaker as never)
    return speaker
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
    const { dict_db, user_id } = get_pieces()
    if (media === 'audio') {
      if (remove) {
        await unlink_junction({ dict_db, table: 'audio_speakers', where: 'audio_id = ? AND speaker_id = ?', params: [media_id, speaker_id], user_id })
      } else {
        await link_junction({ dict_db, table: 'audio_speakers', where: 'audio_id = ? AND speaker_id = ?', params: [media_id, speaker_id], insert_row: { audio_id: media_id, speaker_id }, user_id })
      }
    } else if (media === 'video') {
      if (remove) {
        await unlink_junction({ dict_db, table: 'video_speakers', where: 'video_id = ? AND speaker_id = ?', params: [media_id, speaker_id], user_id })
      } else {
        await link_junction({ dict_db, table: 'video_speakers', where: 'video_id = ? AND speaker_id = ?', params: [media_id, speaker_id], insert_row: { video_id: media_id, speaker_id }, user_id })
      }
    }
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_tag({ name }: { name: string }) {
  try {
    const { dict_db, user_id } = get_pieces()
    const tag = {
      id: randomUUID(),
      name,
      created_by_user_id: user_id,
      updated_by_user_id: user_id,
    }
    await dict_db.tags.insert(tag as never)
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
    const { dict_db, user_id } = get_pieces()
    if (remove) {
      await unlink_junction({ dict_db, table: 'entry_tags', where: 'entry_id = ? AND tag_id = ?', params: [entry_id, tag_id], user_id })
    } else {
      await link_junction({ dict_db, table: 'entry_tags', where: 'entry_id = ? AND tag_id = ?', params: [entry_id, tag_id], insert_row: { entry_id, tag_id }, user_id })
    }
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_dialect({ name }: { name: MultiString }) {
  try {
    const { dict_db, user_id } = get_pieces()
    const dialect = {
      id: randomUUID(),
      name,
      created_by_user_id: user_id,
      updated_by_user_id: user_id,
    }
    await dict_db.dialects.insert(dialect as never)
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
    const { dict_db, user_id } = get_pieces()
    if (remove) {
      await unlink_junction({ dict_db, table: 'entry_dialects', where: 'entry_id = ? AND dialect_id = ?', params: [entry_id, dialect_id], user_id })
    } else {
      await link_junction({ dict_db, table: 'entry_dialects', where: 'entry_id = ? AND dialect_id = ?', params: [entry_id, dialect_id], insert_row: { entry_id, dialect_id }, user_id })
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
  photo: Omit<TablesInsert<'photos'>, SystemInsertFields>
  sense_id: string
}) {
  try {
    const { dict_db, user_id } = get_pieces()
    const photo = {
      id: randomUUID(),
      ...clean(_photo),
      created_by_user_id: user_id,
      updated_by_user_id: user_id,
    }
    await dict_db.photos.insert(photo as never)
    await dict_db.sense_photos.insert({
      photo_id: photo.id,
      sense_id,
      created_by_user_id: user_id,
      updated_by_user_id: user_id,
    } as never)
    return photo
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_photo(photo: TablesUpdate<'photos'>) {
  try {
    const { dict_db, user_id } = get_pieces()
    await dict_db.photos.update({ ...clean(photo), updated_by_user_id: user_id } as never)
    return photo
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
    const { dict_db, user_id } = get_pieces()
    const video = {
      id: randomUUID(),
      ...clean(_video),
      created_by_user_id: user_id,
      updated_by_user_id: user_id,
    }
    await dict_db.videos.insert(video as never)
    await dict_db.sense_videos.insert({
      video_id: video.id,
      sense_id,
      created_by_user_id: user_id,
      updated_by_user_id: user_id,
    } as never)
    return video
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_video(video: TablesUpdate<'videos'>) {
  try {
    const { dict_db, user_id } = get_pieces()
    await dict_db.videos.update({ ...clean(video), updated_by_user_id: user_id } as never)
    return video
  } catch (err) {
    alert(err)
    console.error(err)
  }
}
