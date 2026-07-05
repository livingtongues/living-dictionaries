import type { DictionaryCoordinates } from './shared.types'
import type { HostedElsewhere, MediaTimings, MultiString, SentenceTokens } from './dictionary.types'
import { SOURCE_TYPES } from '$lib/constants'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Drizzle schema for `dictionaries/{id}.db`. One file per dictionary; all
 * editors and viewers of that dict pull from this schema.
 *
 * The DDL itself lives in `./dictionary-migrations/*.sql` — keep the
 * `CREATE TABLE` statements in sync when adding columns or tables.
 *
 * Conventions (per Q5/Q8/Q9 in port-db-sync-architecture.md):
 *   - Deletion is HARD (no `deleted` column): INSERT into `deletes(table_name, id)`
 *     fires `process_delete_cascade`, which DELETEs the row (FK cascade sweeps children).
 *   - Every content table has `dirty INTEGER` (NULL/0 = clean, 1 = needs push).
 *   - Every content table has `created_at`, `created_by_user_id`, `updated_at`, `updated_by_user_id`.
 *   - All junction tables use synthetic UUID PK + UNIQUE on natural key.
 *
 * No users table inside dict.db — just `created_by_user_id` / `updated_by_user_id`
 * text refs (snapshotted display fields are stored only in shared.db.users).
 */

export const migrations = sqliteTable('migrations', {
  id: text().primaryKey(),
  name: text().notNull(),
  run_on: text().notNull(),
})

/**
 * Single-row metadata keyed by string.
 *
 * Required keys:
 *   - `dictionary_id`        — the dict's own id (self-identifying file)
 *   - `last_modified_at`     — bumped by trigger on every content write (sync cursor)
 *   - `schema_version`       — latest applied migration name (fast probe)
 */
export const db_metadata = sqliteTable('db_metadata', {
  key: text().primaryKey(),
  value: text(),
})

/** Sync vehicle + durable delete log. INSERT into `deletes(table_name, id)` HARD-deletes via trigger. */
export const deletes = sqliteTable('deletes', {
  table_name: text().notNull(),
  id: text().notNull(),
  updated_at: text().notNull(),
})

export const entries = sqliteTable('entries', {
  id: text().primaryKey(),
  lexeme: text({ mode: 'json' }).$type<MultiString>().notNull(),
  phonetic: text(),
  interlinearization: text(),
  morphology: text(),
  notes: text({ mode: 'json' }).$type<MultiString>(),
  linguistic_history: text({ mode: 'json' }).$type<MultiString>(),
  sources: text({ mode: 'json' }).$type<string[]>(),
  scientific_names: text({ mode: 'json' }).$type<string[]>(),
  /**
   * Geo data AS STORED (migration preserved the legacy `Coordinates` shape
   * verbatim): `{ points, regions }`, same as a dictionary's coordinates —
   * NOT `{ latitude, longitude }`.
   */
  coordinates: text({ mode: 'json' }).$type<DictionaryCoordinates>(),
  unsupported_fields: text({ mode: 'json' }).$type<Record<string, unknown>>(),
  elicitation_id: text(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const texts = sqliteTable('texts', {
  id: text().primaryKey(),
  title: text({ mode: 'json' }).$type<MultiString>().notNull(),
  /** Array of `sources.slug` refs (no FK — validated on write, integrity-swept on source delete). */
  sources: text({ mode: 'json' }).$type<string[]>(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const senses = sqliteTable('senses', {
  id: text().primaryKey(),
  entry_id: text().notNull().references(() => entries.id, { onDelete: 'cascade' }),
  definition: text({ mode: 'json' }).$type<MultiString>(),
  glosses: text({ mode: 'json' }).$type<MultiString>(),
  parts_of_speech: text({ mode: 'json' }).$type<string[]>(),
  semantic_domains: text({ mode: 'json' }).$type<string[]>(),
  write_in_semantic_domains: text({ mode: 'json' }).$type<string[]>(),
  noun_class: text(),
  plural_form: text({ mode: 'json' }).$type<MultiString>(),
  variant: text({ mode: 'json' }).$type<MultiString>(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const sentences = sqliteTable('sentences', {
  id: text().primaryKey(),
  text: text({ mode: 'json' }).$type<MultiString>(),
  translation: text({ mode: 'json' }).$type<MultiString>(),
  text_id: text().references(() => texts.id, { onDelete: 'set null' }),
  /** Fractional index (LexoRank-style) ordering this sentence within its `text_id`. NULL for standalone example sentences. */
  sort_key: text(),
  /** 1 = a paragraph break follows this sentence (replaces the legacy id-array's paragraph markers). */
  ends_paragraph: integer(),
  /** Array of `sources.slug` refs (no FK — validated on write, integrity-swept on source delete). */
  sources: text({ mode: 'json' }).$type<string[]>(),
  /** Per-orthography tokenization + word→entry match state (see `SentenceTokens`). */
  tokens: text({ mode: 'json' }).$type<SentenceTokens>(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const senses_in_sentences = sqliteTable('senses_in_sentences', {
  id: text().primaryKey(),
  sense_id: text().notNull().references(() => senses.id, { onDelete: 'cascade' }),
  sentence_id: text().notNull().references(() => sentences.id, { onDelete: 'cascade' }),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const speakers = sqliteTable('speakers', {
  id: text().primaryKey(),
  name: text().notNull(),
  decade: integer(),
  gender: text({ enum: ['m', 'f', 'o'] }),
  birthplace: text(),
  user_id: text(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const audio = sqliteTable('audio', {
  id: text().primaryKey(),
  entry_id: text().references(() => entries.id, { onDelete: 'cascade' }),
  sentence_id: text().references(() => sentences.id, { onDelete: 'cascade' }),
  text_id: text().references(() => texts.id, { onDelete: 'cascade' }),
  storage_path: text().notNull(),
  /** A `sources.slug` registry ref (no FK — validated on write, NULLed on source delete). Speaker-less audio must carry one (write-time rule). */
  source: text(),
  /** Sentence id → compact word-timing string for karaoke playback (see `MediaTimings`). */
  timings: text({ mode: 'json' }).$type<MediaTimings>(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const audio_speakers = sqliteTable('audio_speakers', {
  id: text().primaryKey(),
  audio_id: text().notNull().references(() => audio.id, { onDelete: 'cascade' }),
  speaker_id: text().notNull().references(() => speakers.id, { onDelete: 'cascade' }),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const videos = sqliteTable('videos', {
  id: text().primaryKey(),
  storage_path: text(),
  hosted_elsewhere: text({ mode: 'json' }).$type<HostedElsewhere>(),
  /** A `sources.slug` registry ref (no FK — validated on write, NULLed on source delete). Speaker-less video must carry one (write-time rule). */
  source: text(),
  videographer: text(),
  text_id: text().references(() => texts.id, { onDelete: 'cascade' }),
  /** Sentence id → compact word-timing string for karaoke playback (see `MediaTimings`). */
  timings: text({ mode: 'json' }).$type<MediaTimings>(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const video_speakers = sqliteTable('video_speakers', {
  id: text().primaryKey(),
  video_id: text().notNull().references(() => videos.id, { onDelete: 'cascade' }),
  speaker_id: text().notNull().references(() => speakers.id, { onDelete: 'cascade' }),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const sense_videos = sqliteTable('sense_videos', {
  id: text().primaryKey(),
  sense_id: text().notNull().references(() => senses.id, { onDelete: 'cascade' }),
  video_id: text().notNull().references(() => videos.id, { onDelete: 'cascade' }),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const sentence_videos = sqliteTable('sentence_videos', {
  id: text().primaryKey(),
  sentence_id: text().notNull().references(() => sentences.id, { onDelete: 'cascade' }),
  video_id: text().notNull().references(() => videos.id, { onDelete: 'cascade' }),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const photos = sqliteTable('photos', {
  id: text().primaryKey(),
  storage_path: text().notNull(),
  serving_url: text().notNull(),
  /** Free-text caption/attribution prose shown under the photo — NOT a registry ref (unlike audio/videos.source). */
  source: text(),
  photographer: text(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const sense_photos = sqliteTable('sense_photos', {
  id: text().primaryKey(),
  sense_id: text().notNull().references(() => senses.id, { onDelete: 'cascade' }),
  photo_id: text().notNull().references(() => photos.id, { onDelete: 'cascade' }),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const sentence_photos = sqliteTable('sentence_photos', {
  id: text().primaryKey(),
  sentence_id: text().notNull().references(() => sentences.id, { onDelete: 'cascade' }),
  photo_id: text().notNull().references(() => photos.id, { onDelete: 'cascade' }),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const dialects = sqliteTable('dialects', {
  id: text().primaryKey(),
  name: text({ mode: 'json' }).$type<MultiString>().notNull(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const entry_dialects = sqliteTable('entry_dialects', {
  id: text().primaryKey(),
  entry_id: text().notNull().references(() => entries.id, { onDelete: 'cascade' }),
  dialect_id: text().notNull().references(() => dialects.id, { onDelete: 'cascade' }),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const tags = sqliteTable('tags', {
  id: text().primaryKey(),
  name: text().notNull(),
  /** NULL/0 = visible to all; 1 = admin-only (legacy `private` column). */
  private: integer(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const entry_tags = sqliteTable('entry_tags', {
  id: text().primaryKey(),
  entry_id: text().notNull().references(() => entries.id, { onDelete: 'cascade' }),
  tag_id: text().notNull().references(() => tags.id, { onDelete: 'cascade' }),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Per-dictionary registry of CUSTOM relationship types (found-or-created, like
 * `tags`). Global types live in `constants.ts` `RELATIONSHIP_TYPES` and are
 * referenced by slug; a custom type is referenced by `entry_relationships.custom_type_id`.
 */
export const relationship_types = sqliteTable('relationship_types', {
  id: text().primaryKey(),
  name: text({ mode: 'json' }).$type<MultiString>().notNull(),
  /** Directed custom types only — label shown from the `to` side. NULL for symmetric. */
  inverse_name: text({ mode: 'json' }).$type<MultiString>(),
  /** 1 = symmetric (same label both ways); NULL/0 = directed. */
  symmetric: integer(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Typed relationship between two entries (optionally narrowed to senses), within
 * one dictionary. `from_*`/`to_*` are directional; symmetric types are stored in a
 * canonical endpoint order (see `v1-relationship-write.ts`) and read identically
 * from either side. Exactly one of `type` (global slug) / `custom_type_id` is set.
 * Both entry FKs `ON DELETE CASCADE`, so deleting either endpoint removes the link.
 */
export const entry_relationships = sqliteTable('entry_relationships', {
  id: text().primaryKey(),
  from_entry_id: text().notNull().references(() => entries.id, { onDelete: 'cascade' }),
  from_sense_id: text().references(() => senses.id, { onDelete: 'cascade' }),
  to_entry_id: text().notNull().references(() => entries.id, { onDelete: 'cascade' }),
  to_sense_id: text().references(() => senses.id, { onDelete: 'cascade' }),
  /** Global relationship-type slug (see `RELATIONSHIP_TYPES`). NULL when `custom_type_id` is set. */
  type: text(),
  custom_type_id: text().references(() => relationship_types.id, { onDelete: 'cascade' }),
  note: text({ mode: 'json' }).$type<MultiString>(),
  /** Array of `sources.slug` refs (no FK — validated on write). */
  sources: text({ mode: 'json' }).$type<string[]>(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Editor-curated favorites shown on the dictionary home page, ordered by
 * `sort_key` (fractional index, same scheme as `sentences.sort_key`). One row
 * per entry (UNIQUE natural key). NOT shared.db's `featured_entries` (the
 * admin-curated global homepage showcase) — this table is dict-scoped + synced.
 */
export const featured_entries = sqliteTable('featured_entries', {
  id: text().primaryKey(),
  entry_id: text().notNull().references(() => entries.id, { onDelete: 'cascade' }),
  sort_key: text().notNull(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Per-dictionary citation registry. `entries`/`sentences`/`texts` reference rows
 * here by `slug` (array-of-slug columns, NOT a junction). No FK enforces those
 * refs, so writes validate the slug exists and source deletion is refused while
 * referenced (strip-from-all-then-delete is the only removal path).
 */
export const sources = sqliteTable('sources', {
  id: text().primaryKey(),
  /** Stable id referenced by entry/sentence/text `sources` arrays. UNIQUE per dict. */
  slug: text().notNull(),
  /** Full display citation. */
  citation: text(),
  /** Short label for badges + the search facet. */
  abbreviation: text(),
  author: text(),
  /** TEXT (not INTEGER) to allow ranges like "1979–1985". */
  year: text(),
  url: text(),
  license: text(),
  /** The citation kind: dictionary/wordlist/fieldwork/manuscript/other. */
  type: text({ enum: SOURCE_TYPES }),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})
