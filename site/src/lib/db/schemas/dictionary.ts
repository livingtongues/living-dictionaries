import type { HostedElsewhere, MultiString } from './dictionary.types'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Drizzle schema for `dictionaries/{id}.db`. One file per dictionary; all
 * editors and viewers of that dict pull from this schema.
 *
 * The DDL itself lives in `./dictionary-migrations/*.sql` — keep the
 * `CREATE TABLE` statements in sync when adding columns or tables.
 *
 * Conventions (per Q5/Q8/Q9 in port-db-sync-architecture.md):
 *   - Every content table has `deleted TEXT` (NULL = visible, ISO8601 = soft-deleted).
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

/** Sync vehicle. INSERT into `deletes(table_name, id)` fires soft-delete via trigger. */
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
  sources: text({ mode: 'json' }).$type<string[]>(),
  scientific_names: text({ mode: 'json' }).$type<string[]>(),
  coordinates: text({ mode: 'json' }).$type<{ latitude?: number, longitude?: number }>(),
  unsupported_fields: text({ mode: 'json' }).$type<Record<string, unknown>>(),
  elicitation_id: text(),
  deleted: text(),
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
  deleted: text(),
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
  deleted: text(),
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
  deleted: text(),
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
  deleted: text(),
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
  storage_path: text().notNull(),
  source: text(),
  deleted: text(),
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
  deleted: text(),
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
  source: text(),
  videographer: text(),
  deleted: text(),
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
  deleted: text(),
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
  deleted: text(),
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
  deleted: text(),
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
  source: text(),
  photographer: text(),
  deleted: text(),
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
  deleted: text(),
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
  deleted: text(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const dialects = sqliteTable('dialects', {
  id: text().primaryKey(),
  name: text({ mode: 'json' }).$type<MultiString>().notNull(),
  deleted: text(),
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
  deleted: text(),
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
  deleted: text(),
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
  deleted: text(),
  dirty: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})
