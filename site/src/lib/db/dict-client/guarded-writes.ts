import type { MultiString } from '$lib/types'
import type { DictInsertType, DictLiveDb, DictUpdateType } from '$lib/db/dict-client/dict-live-db.svelte'
import type { GlobalRelationshipType, TagKind } from '$lib/constants'
import { key_between } from '$lib/api/v1/fractional-index'
import { canonicalize_relationship_endpoints, resolve_global_relationship_type } from '$lib/db/relationship-canonicalize'
import { log_warning, track } from '$lib/debug/remote-log'
import { ENTRY_CREATED, ENTRY_DELETED } from '$lib/debug/log-events'

// vps-migration M4 write/sync: persistence is the browser wa-sqlite per-dict DB
// (`dict_db`). Single-row ops go through the `dict_db` table accessors; the
// multi-table groups (entry+sense, sentence+junction, media+junction) and
// junction link/unlink go through `dict_db.writes` — ONE atomic `dict_write`
// RPC each, run by the leader worker inside BEGIN/COMMIT under the op-mutex
// (see `dict-writes.ts`). The sync engine pushes dirty rows to the server,
// which re-checks the caller's role. Per-dict rows carry NO `dictionary_id`
// (single-dict file) and REQUIRE `created_by_user_id` / `updated_by_user_id`
// (NOT NULL) — those (plus `id` / `created_at` / `updated_at` / `dirty`) are
// auto-stamped from the editing user set in the layout (see
// `create_dict_live_db({ user_id })`), which is why the params below omit
// them. This facade exists for genuinely multi-table orchestration, junction
// link/unlink, and the shared guard/error interceptor; single-row scalar field
// edits mutate the live row + `_save()`.

export interface WriteQueryConnection {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
}

export interface GuardedWritesDeps {
  dict_db: DictLiveDb | null
  connection: WriteQueryConnection | null
  dictionary: { id: string, url: string }
  get_user_id: () => string | undefined
  /** True while the entries bundle is still loading (edits would race the read-model). */
  is_loading: () => boolean
  /** Error presentation — one place decides (toast in the app, spy in tests). */
  on_error: (err: unknown) => void
}

const BLOCKED_MESSAGES: Record<string, string> = {
  still_loading: 'Wait until loading spinner stops to make edits.',
  no_dict_db: 'Editing database is not ready yet',
  not_signed_in: 'You must be signed in to edit',
}

/**
 * The one write facade components reach through `page.data.writes`
 * (constructed per dict-layout load with explicit deps — no `page.data`
 * reads in here). ONE interceptor wraps every op: readiness guard
 * (`write_blocked` telemetry), error routing to `on_error`, and swallow
 * semantics (ops resolve `undefined` on failure so callers never crash).
 */
export function create_guarded_writes({ dict_db, connection, dictionary, get_user_id, is_loading, on_error }: GuardedWritesDeps) {
  // write_blocked: a user tried to edit but the app refused — the "user thinks
  // they're editing but nothing persists" class (post-cutover logged-out
  // editors, broken worker boot). Queryable ahead of the generic error rows.
  function blocked(reason: string): Error {
    log_warning({ message: 'write_blocked', context: { reason, dictionary_id: dictionary?.id, signed_in: Boolean(get_user_id()) } })
    return new Error(BLOCKED_MESSAGES[reason] ?? reason)
  }

  function ready(): DictLiveDb {
    if (is_loading())
      throw blocked('still_loading')
    if (!dict_db)
      throw blocked('no_dict_db')
    if (!get_user_id())
      throw blocked('not_signed_in')
    return dict_db
  }

  function ready_connection(): WriteQueryConnection {
    if (!connection)
      throw new Error('Editing database is not ready yet')
    return connection
  }

  function guard<Args extends unknown[], Result>(op: (db: DictLiveDb, ...args: Args) => Promise<Result>): (...args: Args) => Promise<Result | undefined> {
    return async (...args: Args) => {
      try {
        return await op(ready(), ...args)
      } catch (err) {
        on_error(err)
        console.error(err)
        return undefined
      }
    }
  }

  return {
    /**
     * Up-front readiness probe for flows that do slow work BEFORE their DB
     * write (media upload): surfaces the same blocked toast + `write_blocked`
     * telemetry as a guarded op and returns the error so the caller can abort
     * before starting — otherwise an upload finishing after a blocked insert
     * looks like success while the row is silently dropped.
     */
    check_ready: (): Error | null => {
      try {
        ready()
        return null
      } catch (err) {
        on_error(err)
        console.error(err)
        return err as Error
      }
    },

    insert_entry: guard(async (db, lexeme: MultiString) => {
      const entry = await db.writes.insert_entry({ lexeme })
      track({ event: ENTRY_CREATED, props: { dictionary_id: dictionary.id, entry_id: entry.id } })
      return entry
    }),

    delete_entry: guard(async (db, entry_id: string) => {
      await db.entries.delete(entry_id)
      track({ event: ENTRY_DELETED, props: { dictionary_id: dictionary.id, entry_id } })
    }),

    insert_sense: guard(async (db, entry_id: string) => {
      await db.senses.insert({ entry_id })
    }),

    delete_sense: guard(async (db, sense_id: string) => {
      await db.senses.delete(sense_id)
    }),

    insert_sentence: guard(async (db, { sentence, sense_id }: { sentence: DictInsertType<'sentences'>, sense_id: string }) => {
      return await db.writes.insert_sentence({ sentence, sense_id })
    }),

    // Worker-side op (not the generic table update): when `text` changes the
    // tokens are recomputed in the same transaction (carry-over preserves
    // confirmed/gold-IGT tokens; vanished forms clean their junction rows).
    update_sentence: guard(async (db, sentence: DictUpdateType<'sentences'>) => {
      return await db.writes.update_sentence({ sentence })
    }),

    /** Bulk insert (text append / standalone add) with auto-matching. */
    insert_sentences: guard(async (db, rows: DictInsertType<'sentences'>[]) => {
      return await db.writes.insert_sentences({ rows })
    }),

    delete_sentence: guard(async (db, sentence_id: string) => {
      await db.sentences.delete(sentence_id)
    }),

    /** Tokenize + auto-match a whole text (reader "Re-analyze") or one sentence. */
    analyze_text: guard(async (db, text_id: string) => {
      return await db.writes.analyze_sentences({ text_id })
    }),

    analyze_sentence: guard(async (db, sentence_id: string) => {
      return await db.writes.analyze_sentences({ sentence_ids: [sentence_id] })
    }),

    /** Confirm a token→entry match (sense link mirrors into `senses_in_sentences`). */
    confirm_token: guard(async (db, { sentence_id, orthography, token_index, entry_id, sense_id }: {
      sentence_id: string
      orthography: string
      token_index: number
      entry_id: string
      sense_id?: string
    }) => {
      return await db.writes.set_token_link({ sentence_id, orthography, token_index, action: 'confirm', entry_id, sense_id })
    }),

    /** Back to unmatched (drops link + junction row for text sentences). */
    unlink_token: guard(async (db, { sentence_id, orthography, token_index }: {
      sentence_id: string
      orthography: string
      token_index: number
    }) => {
      return await db.writes.set_token_link({ sentence_id, orthography, token_index, action: 'unlink' })
    }),

    ignore_token: guard(async (db, { sentence_id, orthography, token_index, form, everywhere }: {
      sentence_id: string
      orthography: string
      token_index: number
      /** The token's surface form — required for `everywhere`. */
      form?: string
      /** Bulk-ignore every non-confirmed occurrence across the dictionary. */
      everywhere?: boolean
    }) => {
      if (everywhere && form)
        return await db.writes.ignore_form({ form })
      return await db.writes.set_token_link({ sentence_id, orthography, token_index, action: 'ignore' })
    }),

    /** New entry (+ first sense) from an unmatched token, confirmed in one transaction. */
    create_entry_from_token: guard(async (db, { lexeme, sentence_id, orthography, token_index }: {
      lexeme: MultiString
      sentence_id: string
      orthography: string
      token_index: number
    }) => {
      const entry = await db.writes.create_entry_from_token({ lexeme, sentence_id, orthography, token_index })
      track({ event: ENTRY_CREATED, props: { dictionary_id: dictionary.id, entry_id: entry.id } })
      return entry
    }),

    insert_audio: guard(async (db, { id, storage_path, entry_id, speaker_id, source }: {
      /** Pre-minted row uuid (R2 uploads key the object by it BEFORE the insert). */
      id?: string
      storage_path: string
      entry_id: string
      speaker_id?: string
      /** A `sources.slug` registry ref — the speaker-less attribution path. */
      source?: string
    }) => {
      return await db.writes.insert_audio({ audio: { ...(id ? { id } : {}), storage_path, entry_id, ...(source ? { source } : {}) }, speaker_id })
    }),

    update_audio: guard(async (db, audio: DictUpdateType<'audio'>) => {
      await db.audio.update(audio)
      return audio
    }),

    delete_audio: guard(async (db, audio_id: string) => {
      await db.audio.delete(audio_id)
    }),

    insert_speaker: guard(async (db, speaker: DictInsertType<'speakers'>) => {
      const [new_speaker] = await db.speakers.insert(speaker)
      return new_speaker
    }),

    assign_speaker: guard(async (db, { speaker_id, media_id, media, remove }: {
      speaker_id: string
      media_id: string
      media: 'audio' | 'video'
      remove?: boolean
    }) => {
      const table = media === 'audio' ? 'audio_speakers' as const : 'video_speakers' as const
      const key = media === 'audio' ? { audio_id: media_id, speaker_id } : { video_id: media_id, speaker_id }
      if (remove)
        await db.writes.unlink_junction({ table, key })
      else
        await db.writes.link_junction({ table, key })
    }),

    insert_tag: guard(async (db, { name }: { name: string }) => {
      const trimmed = name.trim()
      // Dedup by name (case-insensitive) so a write-in reuses an existing tag
      // instead of minting a duplicate — the write-in path can't see existing
      // tags when the dictionary store hasn't loaded yet, which is how dictionaries
      // accumulated hundreds of same-named tag rows. Mirrors the server v1 dedup.
      const existing = await db.tags.query({ where: 'lower(name) = lower(?)', params: [trimmed] }).snapshot()
      if (existing.length)
        return existing[0]
      const [tag] = await db.tags.insert({ name: trimmed })
      return tag
    }),

    assign_tag: guard(async (db, { tag_id, entry_id, remove }: {
      tag_id: string
      entry_id: string
      remove?: boolean
    }) => {
      const key = { entry_id, tag_id }
      if (remove)
        await db.writes.unlink_junction({ table: 'entry_tags', key })
      else
        await db.writes.link_junction({ table: 'entry_tags', key })
    }),

    /**
     * Link an existing sentence to a grammar section as an ordered example
     * (`section_sentences` junction). Dedupes by natural key; appends after the
     * given sibling (or at the end) with a fractional `sort_key`. The junction
     * carries ordering, so this inserts directly rather than via `link_junction`
     * (which never sets `sort_key`).
     */
    attach_section_sentence: guard(async (db, { section_id, sentence_id, after_sort_key, before_sort_key }: {
      section_id: string
      sentence_id: string
      /** Sibling to append after (its `sort_key`); null → prepend/first. */
      after_sort_key?: string | null
      /** Sibling to insert before (its `sort_key`); null → append/last. */
      before_sort_key?: string | null
    }) => {
      const existing = await db.section_sentences.query({ where: 'section_id = ? AND sentence_id = ?', params: [section_id, sentence_id] }).snapshot()
      if (existing.length)
        return existing[0]
      const sort_key = key_between(after_sort_key ?? null, before_sort_key ?? null)
      const [row] = await db.section_sentences.insert({ section_id, sentence_id, sort_key })
      return row
    }),

    detach_section_sentence: guard(async (db, { section_id, sentence_id }: { section_id: string, sentence_id: string }) => {
      await db.writes.unlink_junction({ table: 'section_sentences', key: { section_id, sentence_id } })
    }),

    /**
     * Attach a text-classification tag (motif / genre / tale-type) to a text —
     * find-or-create the kinded tag by (name, kind) then link via `text_tags`.
     * Mirrors the server v1 `link_text_tag` dedupe.
     */
    assign_text_tag: guard(async (db, { text_id, name, kind, code }: {
      text_id: string
      name: string
      kind: TagKind
      code?: string
    }) => {
      const trimmed = name.trim()
      const existing = await db.tags.query({ where: 'lower(name) = lower(?) AND kind = ?', params: [trimmed, kind] }).snapshot()
      const tag = existing[0] ?? (await db.tags.insert({ name: trimmed, kind, ...(code?.trim() ? { code: code.trim() } : {}) }))[0]
      await db.writes.link_junction({ table: 'text_tags', key: { text_id, tag_id: tag.id } })
      return tag
    }),

    remove_text_tag: guard(async (db, { text_id, tag_id }: { text_id: string, tag_id: string }) => {
      await db.writes.unlink_junction({ table: 'text_tags', key: { text_id, tag_id } })
    }),

    insert_dialect: guard(async (db, { name }: { name: MultiString }) => {
      // Dedup by default-locale name (case-insensitive) — same rationale as
      // insert_tag: a write-in must reuse an existing dialect, not duplicate it.
      const default_name = (name.default ?? '').trim().toLowerCase()
      if (default_name) {
        const all = await db.dialects.query({}).snapshot()
        const existing = all.find(dialect => (dialect.name?.default ?? '').trim().toLowerCase() === default_name)
        if (existing)
          return existing
      }
      const [dialect] = await db.dialects.insert({ name })
      return dialect
    }),

    assign_dialect: guard(async (db, { dialect_id, entry_id, remove }: {
      dialect_id: string
      entry_id: string
      remove?: boolean
    }) => {
      const key = { entry_id, dialect_id }
      if (remove)
        await db.writes.unlink_junction({ table: 'entry_dialects', key })
      else
        await db.writes.link_junction({ table: 'entry_dialects', key })
    }),

    /**
     * Local-first counterpart of the server's `apply_relationship_create` (v1 API):
     * same canonicalization (inverse-alias flip + symmetric endpoint sort via the
     * shared `relationship-canonicalize` module) and the same natural-key dedupe,
     * so both surfaces store identical rows. Entry-level only (no sense narrowing
     * in the UI yet — the API supports it).
     */
    insert_relationship: guard(async (db, { from_entry_id, to_entry_id, type, custom_type_id, note }: {
      from_entry_id: string
      to_entry_id: string
      /** A global relationship-type slug. Provide THIS or `custom_type_id`. */
      type?: GlobalRelationshipType
      /** An EXISTING `relationship_types` row id. Provide THIS or `type`. */
      custom_type_id?: string
      note?: MultiString
    }) => {
      const query_connection = ready_connection()
      if (from_entry_id === to_entry_id)
        throw new Error('Cannot relate an entry to itself')

      let symmetric: boolean
      let flip = false
      let stored_type: string | undefined
      if (type) {
        ({ type: stored_type, symmetric, flip } = resolve_global_relationship_type(type))
      } else if (custom_type_id) {
        const [type_row] = await query_connection.query<{ symmetric: number | null }>(`SELECT symmetric FROM relationship_types WHERE id = ?`, [custom_type_id])
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

      const existing = await find_duplicate_relationship({ connection: query_connection, from_entry_id: from.entry_id, to_entry_id: to.entry_id, stored_type, custom_type_id })
      if (existing)
        return existing

      const [relationship] = await db.entry_relationships.insert({
        from_entry_id: from.entry_id,
        to_entry_id: to.entry_id,
        ...(stored_type ? { type: stored_type } : {}),
        ...(custom_type_id ? { custom_type_id } : {}),
        ...(note ? { note } : {}),
      })
      return relationship
    }),

    delete_relationship: guard(async (db, relationship_id: string) => {
      await db.entry_relationships.delete(relationship_id)
    }),

    insert_source: guard(async (db, source: DictInsertType<'sources'>) => {
      const [row] = await db.sources.insert(source)
      return row
    }),

    update_source: guard(async (db, source: DictUpdateType<'sources'>) => {
      await db.sources.update(source)
      return source
    }),

    /**
     * Strip a source slug from every entry/sentence/text that references it, NULL
     * it on referencing audio/videos rows, then delete the source row. Mirrors the
     * server's `remove_source_from_all` + `apply_source_delete` — the only path
     * that removes an in-use source (no dangling slugs left behind). An
     * audio/video whose only attribution was this source becomes unattributed —
     * legal (the speaker-or-source rule is write-time only).
     */
    remove_source_and_delete: guard(async (db, { source_id, slug }: { source_id: string, slug: string }) => {
      await scrub_source_slug({ db, connection: ready_connection(), slug })
      await db.sources.delete(source_id)
    }),

    insert_photo: guard(async (db, { photo, sense_id }: { photo: DictInsertType<'photos'>, sense_id: string }) => {
      return await db.writes.insert_photo({ photo, sense_id })
    }),

    update_photo: guard(async (db, photo: DictUpdateType<'photos'>) => {
      await db.photos.update(photo)
      return photo
    }),

    delete_photo: guard(async (db, photo_id: string) => {
      await db.photos.delete(photo_id)
    }),

    insert_video: guard(async (db, { video, sense_id, speaker_id }: {
      video: DictInsertType<'videos'>
      sense_id: string
      speaker_id?: string
    }) => {
      return await db.writes.insert_video({ video, sense_id, speaker_id })
    }),

    update_video: guard(async (db, video: DictUpdateType<'videos'>) => {
      await db.videos.update(video)
      return video
    }),

    delete_video: guard(async (db, video_id: string) => {
      await db.videos.delete(video_id)
    }),
  }
}

export type GuardedWrites = ReturnType<typeof create_guarded_writes>

/** Natural-key dedupe query shared with the server's relationship create. */
async function find_duplicate_relationship({ connection, from_entry_id, to_entry_id, stored_type, custom_type_id }: {
  connection: WriteQueryConnection
  from_entry_id: string
  to_entry_id: string
  stored_type: string | undefined
  custom_type_id: string | undefined
}): Promise<{ id: string } | undefined> {
  const [existing] = await connection.query<{ id: string }>(
    `SELECT id FROM entry_relationships
      WHERE from_entry_id = ? AND COALESCE(from_sense_id,'') = ''
        AND to_entry_id = ? AND COALESCE(to_sense_id,'') = ''
        AND COALESCE(type,'') = ? AND COALESCE(custom_type_id,'') = ?`,
    [from_entry_id, to_entry_id, stored_type ?? '', custom_type_id ?? ''],
  )
  return existing
}

/** Remove `slug` from `sources` JSON arrays + NULL it on media rows. */
async function scrub_source_slug({ db, connection, slug }: {
  db: DictLiveDb
  connection: WriteQueryConnection
  slug: string
}): Promise<void> {
  for (const table of ['entries', 'sentences', 'texts'] as const) {
    const rows = await connection.query<{ id: string, sources: string | null }>(
      `SELECT id, sources FROM "${table}" WHERE sources IS NOT NULL AND EXISTS (SELECT 1 FROM json_each("${table}".sources) WHERE value = ?)`,
      [slug],
    )
    for (const row of rows) {
      const current = JSON.parse(row.sources ?? '[]') as string[]
      const next = current.filter(existing_slug => existing_slug !== slug)
      await db[table].update({ id: row.id, sources: next.length ? next : null } as never)
    }
  }
  for (const table of ['audio', 'videos'] as const) {
    const rows = await connection.query<{ id: string }>(`SELECT id FROM "${table}" WHERE source = ?`, [slug])
    for (const row of rows)
      await db[table].update({ id: row.id, source: null } as never)
  }
}
