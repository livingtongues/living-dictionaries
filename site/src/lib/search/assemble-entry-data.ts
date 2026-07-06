import type { EntryData, Tables } from '$lib/types'
import { should_include_tag } from '$lib/helpers/tag-visibility'
import { dedupe_by_id } from '$lib/utils/dedupe-by-id'

type SenseSentences = NonNullable<EntryData['senses'][number]['sentences']>
type SensePhotos = NonNullable<EntryData['senses'][number]['photos']>
type SenseVideos = NonNullable<EntryData['senses'][number]['videos']>

export interface AssembleEntryDataInput {
  /** Raw entries row (JSON columns parsed). Bookkeeping columns are stripped into `main`. */
  entry: Tables<'entries'> & Record<string, unknown>
  /** This entry's sense rows, pre-sorted by `created_at` ascending. */
  senses: (Tables<'senses'> & Record<string, unknown>)[]
  /** Per-sense example sentences, keyed by `sense_id`. */
  sentences_by_sense: Record<string, SenseSentences>
  /** Per-sense photos, keyed by `sense_id`. */
  photos_by_sense: Record<string, SensePhotos>
  /** Per-sense videos (each with `speakers` attached), keyed by `sense_id`. */
  videos_by_sense: Record<string, SenseVideos>
  /** This entry's audio rows (each with `speakers` attached), pre-sorted by `created_at` ascending. */
  audios: NonNullable<EntryData['audios']>
  /** This entry's resolved tag rows — pre-admin-filter (the visibility rule is applied here). */
  tags: NonNullable<EntryData['tags']>
  /** This entry's resolved dialect rows. */
  dialects: NonNullable<EntryData['dialects']>
  /** Numeric admin level of the viewer (0 = anonymous/regular) — gates private + `v4` tags. */
  admin_level: number
}

/**
 * The single source of truth that shapes one entry's subgraph into the
 * denormalized `EntryData` read-model used by SEO, search, and the
 * list/gallery/table/print/detail views. Shared by:
 *
 *  - the browser Orama worker (`entry.worker.ts` `process_entry`), which feeds
 *    slices from its in-memory grouping maps, and
 *  - the server SSR endpoint (`lib/db/server/build-entry-data.ts`), which feeds
 *    slices gathered per-entry from the per-dict better-sqlite3 DB.
 *
 * Keeping this one function guarantees SSR-built and client-built entries are
 * byte-identical → no hydration mismatch. It only builds representation #2 (the
 * read-model); editing still flows through the live `DictLiveDb` row.
 */
export function assemble_entry_data(input: AssembleEntryDataInput): EntryData {
  const { entry, senses, sentences_by_sense, photos_by_sense, videos_by_sense, audios, tags, dialects, admin_level } = input

  // Strip entry bookkeeping columns → `main` (mirrors the worker's destructure).
  const {
    id,
    dictionary_id,
    created_at,
    created_by,
    updated_by,
    created_by_user_id,
    updated_by_user_id,
    dirty,
    updated_at,
    ...main
  } = entry as Tables<'entries'> & Record<string, unknown>

  // De-dupe every id-keyed child array. The entry surfaces render these in
  // keyed `{#each … (row.id)}` blocks; a single duplicate junction row in a
  // client's local dict DB otherwise throws `each_key_duplicate` and blanks the
  // page. Deduping here (the one choke point shared by SSR + the Orama worker)
  // keeps server- and client-built entries identical. See
  // `.issues/entry-page-duplicate-key-crash.md`.
  const senses_with_all = dedupe_by_id(senses).map((sense) => {
    const { entry_id, ...sense_to_include } = sense as Tables<'senses'> & Record<string, unknown>
    const sentences = sentences_by_sense[sense.id]?.length ? dedupe_by_id(sentences_by_sense[sense.id]) : undefined
    const photos = photos_by_sense[sense.id]?.length ? dedupe_by_id(photos_by_sense[sense.id]) : undefined
    const videos = videos_by_sense[sense.id]?.length ? dedupe_by_id(videos_by_sense[sense.id]) : undefined
    return {
      ...sense_to_include,
      ...(sentences ? { sentences } : {}),
      ...(photos ? { photos } : {}),
      ...(videos ? { videos } : {}),
    }
  }) as EntryData['senses']

  const deduped_audios = dedupe_by_id(audios)
  const visible_tags = dedupe_by_id(tags).filter(tag => should_include_tag(tag, admin_level))
  const deduped_dialects = dedupe_by_id(dialects)

  return {
    id: id as string,
    main: main as EntryData['main'],
    updated_at: updated_at as string,
    senses: senses_with_all,
    ...(deduped_audios.length ? { audios: deduped_audios } : {}),
    ...(visible_tags.length ? { tags: visible_tags } : {}),
    ...(deduped_dialects.length ? { dialects: deduped_dialects } : {}),
  }
}
