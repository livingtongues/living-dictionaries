import { get } from 'svelte/store'
import type { Writable } from 'svelte/store'
import type { MultiString } from '$lib/types'
import type { DictInsertType, DictLiveDb, DictUpdateType } from '$lib/db/dict-client/dict-live-db.svelte'
import type { GlobalRelationshipType } from '$lib/constants'
import { canonicalize_relationship_endpoints, resolve_global_relationship_type } from '$lib/db/relationship-canonicalize'
import { page } from '$app/state'
import { goto } from '$app/navigation'
import { log_warning, track } from '$lib/debug/remote-log'
import { ENTRY_CREATED, ENTRY_DELETED } from '$lib/debug/log-events'

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
  const { dictionary, dict_db, connection, auth_user, entries_data } = page.data as unknown as {
    dictionary: { id: string, url: string }
    dict_db: DictLiveDb | null
    connection: { query: <T>(sql: string, params?: unknown[]) => Promise<T[]> } | null
    auth_user: { user: { id: string } | null }
    entries_data: { loading: Writable<boolean> }
  }
  // write_blocked: a user tried to edit but the app refused — the "user thinks
  // they're editing but nothing persists" class (post-cutover logged-out
  // editors, broken worker boot). Queryable ahead of the generic error rows.
  function blocked(reason: string): Error {
    log_warning({ message: 'write_blocked', context: { reason, dictionary_id: dictionary?.id, signed_in: Boolean(auth_user?.user?.id) } })
    return new Error(reason === 'not_signed_in' ? 'You must be signed in to edit' : reason === 'no_dict_db' ? 'Editing database is not ready yet' : 'db operations not ready yet')
  }
  const loading = get(entries_data.loading)
  if (loading) {
    alert('Wait until loading spinner stops to make edits.')
    throw blocked('still_loading')
  }
  if (!dict_db)
    throw blocked('no_dict_db')
  if (!auth_user.user?.id)
    throw blocked('not_signed_in')

  const entry_id_from_page = page.params.entryId || (page.state as { entry_id?: string }).entry_id
  return { dictionary_id: dictionary.id, dictionary_url: dictionary.url, entry_id_from_page, dict_db, connection }
}

export async function insert_entry(lexeme: MultiString) {
  try {
    const { dictionary_id, dictionary_url, dict_db } = get_pieces()
    const entry = await dict_db.writes.insert_entry({ lexeme })
    track({ event: ENTRY_CREATED, props: { dictionary_id, entry_id: entry.id } })
    goto(`/${dictionary_url}/entry/${entry.id}`)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function delete_entry(entry_id?: string) {
  try {
    const { dictionary_id, entry_id_from_page, dict_db } = get_pieces()
    const deleted_id = entry_id || entry_id_from_page
    await dict_db.entries.delete(deleted_id)
    track({ event: ENTRY_DELETED, props: { dictionary_id, entry_id: deleted_id } })
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
  source,
}: {
  storage_path: string
  entry_id: string
  speaker_id?: string
  /** A `sources.slug` registry ref — the speaker-less attribution path. */
  source?: string
}) {
  try {
    const { dict_db } = get_pieces()
    return await dict_db.writes.insert_audio({ audio: { storage_path, entry_id, ...(source ? { source } : {}) }, speaker_id })
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
    const trimmed = name.trim()
    // Dedup by name (case-insensitive) so a write-in reuses an existing tag
    // instead of minting a duplicate — the write-in path can't see existing
    // tags when the dictionary store hasn't loaded yet, which is how dictionaries
    // accumulated hundreds of same-named tag rows. Mirrors the server v1 dedup.
    const existing = await dict_db.tags.query({ where: 'lower(name) = lower(?)', params: [trimmed] }).snapshot()
    if (existing.length)
      return existing[0]
    const [tag] = await dict_db.tags.insert({ name: trimmed })
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

export async function insert_source(source: DictInsertType<'sources'>) {
  try {
    const { dict_db } = get_pieces()
    const [row] = await dict_db.sources.insert(source)
    return row
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function update_source(source: DictUpdateType<'sources'>) {
  try {
    const { dict_db } = get_pieces()
    await dict_db.sources.update(source)
    return source
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

/**
 * Strip a source slug from every entry/sentence/text that references it, NULL
 * it on referencing audio/videos rows, then delete the source row. Mirrors the
 * server's `remove_source_from_all` + `apply_source_delete` — the only path
 * that removes an in-use source (no dangling slugs left behind). An
 * audio/video whose only attribution was this source becomes unattributed —
 * legal (the speaker-or-source rule is write-time only).
 */
export async function remove_source_and_delete({ source_id, slug }: { source_id: string, slug: string }) {
  try {
    const { dict_db, connection } = get_pieces()
    if (!connection)
      throw new Error('Editing database is not ready yet')
    for (const table of ['entries', 'sentences', 'texts'] as const) {
      const rows = await connection.query<{ id: string, sources: string | null }>(
        `SELECT id, sources FROM "${table}" WHERE sources IS NOT NULL AND EXISTS (SELECT 1 FROM json_each("${table}".sources) WHERE value = ?)`,
        [slug],
      )
      for (const row of rows) {
        const current = JSON.parse(row.sources ?? '[]') as string[]
        const next = current.filter(existing_slug => existing_slug !== slug)
        await dict_db[table].update({ id: row.id, sources: next.length ? next : null } as never)
      }
    }
    for (const table of ['audio', 'videos'] as const) {
      const rows = await connection.query<{ id: string }>(`SELECT id FROM "${table}" WHERE source = ?`, [slug])
      for (const row of rows)
        await dict_db[table].update({ id: row.id, source: null } as never)
    }
    await dict_db.sources.delete(source_id)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

/**
 * Local-first counterpart of the server's `apply_relationship_create` (v1 API):
 * same canonicalization (inverse-alias flip + symmetric endpoint sort via the
 * shared `relationship-canonicalize` module) and the same natural-key dedupe,
 * so both surfaces store identical rows. Entry-level only (no sense narrowing
 * in the UI yet — the API supports it).
 */
export async function insert_relationship({ from_entry_id, to_entry_id, type, custom_type_id, note }: {
  from_entry_id: string
  to_entry_id: string
  /** A global relationship-type slug. Provide THIS or `custom_type_id`. */
  type?: GlobalRelationshipType
  /** An EXISTING `relationship_types` row id. Provide THIS or `type`. */
  custom_type_id?: string
  note?: MultiString
}) {
  try {
    const { dict_db, connection } = get_pieces()
    if (!connection)
      throw new Error('Editing database is not ready yet')
    if (from_entry_id === to_entry_id)
      throw new Error('Cannot relate an entry to itself')

    let symmetric = false
    let flip = false
    let stored_type: string | undefined
    if (type) {
      ({ type: stored_type, symmetric, flip } = resolve_global_relationship_type(type))
    } else if (custom_type_id) {
      const [type_row] = await connection.query<{ symmetric: number | null }>(`SELECT symmetric FROM relationship_types WHERE id = ?`, [custom_type_id])
      if (!type_row)
        throw new Error('Unknown relationship type')
      symmetric = !!type_row.symmetric
    } else {
      throw new Error('A relationship type is required')
    }

    const { from, to } = canonicalize_relationship_endpoints({
      from: { entry_id: from_entry_id, sense_id: null },
      to: { entry_id: to_entry_id, sense_id: null },
      symmetric,
      flip,
    })

    const [existing] = await connection.query<{ id: string }>(
      `SELECT id FROM entry_relationships
        WHERE from_entry_id = ? AND COALESCE(from_sense_id,'') = ''
          AND to_entry_id = ? AND COALESCE(to_sense_id,'') = ''
          AND COALESCE(type,'') = ? AND COALESCE(custom_type_id,'') = ?`,
      [from.entry_id, to.entry_id, stored_type ?? '', custom_type_id ?? ''],
    )
    if (existing)
      return existing

    const [relationship] = await dict_db.entry_relationships.insert({
      from_entry_id: from.entry_id,
      to_entry_id: to.entry_id,
      ...(stored_type ? { type: stored_type } : {}),
      ...(custom_type_id ? { custom_type_id } : {}),
      ...(note ? { note } : {}),
    })
    return relationship
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function delete_relationship(relationship_id: string) {
  try {
    const { dict_db } = get_pieces()
    await dict_db.entry_relationships.delete(relationship_id)
  } catch (err) {
    alert(err)
    console.error(err)
  }
}

export async function insert_dialect({ name }: { name: MultiString }) {
  try {
    const { dict_db } = get_pieces()
    // Dedup by default-locale name (case-insensitive) — same rationale as
    // insert_tag: a write-in must reuse an existing dialect, not duplicate it.
    const default_name = (name.default ?? '').trim().toLowerCase()
    if (default_name) {
      const all = await dict_db.dialects.query({}).snapshot()
      const existing = all.find(dialect => (dialect.name?.default ?? '').trim().toLowerCase() === default_name)
      if (existing)
        return existing
    }
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
