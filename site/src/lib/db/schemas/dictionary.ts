import type { DictionaryCoordinates } from './shared.types'
import type { HostedElsewhere, MediaTimings, MultiString, SentenceTokens, SourceCitation } from './dictionary.types'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { DISCOURSE_ROLES, SOURCE_TYPES, TAG_KINDS } from '$lib/constants'
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
  server_seq: integer(),
})

export const entries = sqliteTable('entries', {
  id: text().primaryKey(),
  lexeme: text({ mode: 'json' }).$type<MultiString>().notNull(),
  /** Printed-dictionary homograph number ("1", "2"; some sources use "a"/"b") —
   *  distinguishes deliberately identical headwords from accidental duplicates.
   *  Rendered as a superscript after the lexeme. */
  homograph: text(),
  phonetic: text(),
  interlinearization: text(),
  morphology: text(),
  notes: text({ mode: 'json' }).$type<MultiString>(),
  linguistic_history: text({ mode: 'json' }).$type<MultiString>(),
  sources: text({ mode: 'json' }).$type<string[]>(),
  /** Source refs WITH a citation locus (page/example number); complements `sources[]` (see `SourceCitation`). */
  citations: text({ mode: 'json' }).$type<SourceCitation[]>(),
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
  server_seq: integer(),
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
  /** Source refs WITH a citation locus (page/example number); complements `sources[]` (see `SourceCitation`). */
  citations: text({ mode: 'json' }).$type<SourceCitation[]>(),
  /** Synopsis/abstract of the text, per language. */
  summary: text({ mode: 'json' }).$type<MultiString>(),
  /** Grouping key: texts sharing a `work_id` are versions of ONE work (parallel
   *  texts across dialects — hymnal/scripture). Agent-supplied or minted; no FK. */
  work_id: text(),
  dirty: integer(),
  server_seq: integer(),
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
  /** Array of `sources.slug` refs (no FK — validated on write, integrity-swept on
   *  source delete) — per-sense provenance when senses come from different sources. */
  sources: text({ mode: 'json' }).$type<string[]>(),
  dirty: integer(),
  server_seq: integer(),
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
  /** Salience band / information role in narrative (see `DISCOURSE_ROLES`); nullable. */
  discourse_role: text({ enum: DISCOURSE_ROLES }),
  /** The author's own example number (e.g. "(2a)") for cross-referencing within a grammar. */
  example_label: text(),
  /** Source refs WITH a citation locus (page/example number); complements `sources[]` (see `SourceCitation`). */
  citations: text({ mode: 'json' }).$type<SourceCitation[]>(),
  dirty: integer(),
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

export const dialects = sqliteTable('dialects', {
  id: text().primaryKey(),
  name: text({ mode: 'json' }).$type<MultiString>().notNull(),
  /** Where-spoken geometry for the whole variety — same `{ points, regions }` shape
   *  as a dictionary's/entry's coordinates. The areal extent, set once here rather
   *  than repeated on every entry. */
  coordinates: text({ mode: 'json' }).$type<DictionaryCoordinates>(),
  dirty: integer(),
  server_seq: integer(),
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
  server_seq: integer(),
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
  /** NULL = plain entry tag; else classifies a TEXT (motif/genre/tale-type) via `text_tags` (see `TAG_KINDS`). */
  kind: text({ enum: TAG_KINDS }),
  /** Controlled index code for a classification tag (e.g. an ATU/Thompson motif number). */
  code: text(),
  dirty: integer(),
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
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
  server_seq: integer(),
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
  /** The citation kind — see `SOURCE_TYPES` (dictionary/wordlist/fieldwork/manuscript/video/grammar/phrasebook/hymnal/primer/corpus/other). */
  type: text({ enum: SOURCE_TYPES }),
  /** Which script/orthography this source's forms use — a `code` from `dictionaries.orthographies` (nullable), so multiple romanizations/scripts in one corpus aren't conflated. */
  orthography: text(),
  dirty: integer(),
  server_seq: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Per-dictionary vocabulary of clause-template positions (a "clause slot" like
 * pre-subject / modal / pre-verb / final). Ordered by `sort_key`, the list IS
 * the clause template; a `grammar_sections.slot_id` places a particle in its
 * slot so the UI can render a template diagram and order particles correctly.
 * Found-or-created per dict, like `tags`/`dialects`.
 */
export const clause_slots = sqliteTable('clause_slots', {
  id: text().primaryKey(),
  sort_key: text().notNull(),
  name: text({ mode: 'json' }).$type<MultiString>().notNull(),
  /** Optional short code for the slot. */
  code: text(),
  dirty: integer(),
  server_seq: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Per-dictionary glossing-abbreviations legend (`3PL` → "third person plural").
 * Makes IGT gloss lines self-documenting: a code found here (matched as a
 * substring of a gloss cell) renders SMALL CAPS + tap-to-expand — so no
 * per-token "grammatical?" flag is needed. Found-or-created by `code`; seed from
 * the standard Leipzig set + custom codes.
 */
export const glossing_abbreviations = sqliteTable('glossing_abbreviations', {
  id: text().primaryKey(),
  /** The abbreviation as it appears in glosses, e.g. "3PL", "PFV", "CLF". UNIQUE per dict. */
  code: text().notNull(),
  /** Expansion, per analysis language, e.g. "third person plural". */
  name: text({ mode: 'json' }).$type<MultiString>().notNull(),
  /** Optional grouping for the legend UI (person / number / tense / aspect / case…). */
  category: text(),
  dirty: integer(),
  server_seq: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Hierarchical grammar section tree — the structured, entry-linked replacement
 * for the legacy single free-text `dictionaries.grammar` blob (migrated into a
 * headless section + column dropped, 2026-07-15). A section usually documents
 * ONE lexeme: link it via
 * `entry_id` (+ optional `sense_id`) and it surfaces as "grammar notes" on that
 * entry, while the section pulls the entry's lexeme/phonetic/audio. Prose
 * (`title`/`body`/`usage_conditions`) is per-analysis-language markdown; example
 * sentences attach by reference via `section_sentences`.
 *
 * `parent_id` self-FK is safe under the sync engine's `PRAGMA defer_foreign_keys
 * = ON` (children may arrive before parents in a batch). `entry_id`/`sense_id`/
 * `slot_id` are SET NULL so documentation outlives the thing it points at.
 */
export const grammar_sections = sqliteTable('grammar_sections', {
  id: text().primaryKey(),
  parent_id: text().references((): AnySQLiteColumn => grammar_sections.id, { onDelete: 'cascade' }),
  /** Fractional index (LexoRank-style) ordering this section AMONG ITS SIBLINGS (same `parent_id`). */
  sort_key: text().notNull(),
  /** Optional explicit label ("2.2.1.1"); when NULL, derived from tree position. Stored form lets an imported grammar keep its own numbering. */
  number_label: text(),
  /** Section heading, per analysis language (markdown-capable, usually short). Optional — a section may be headless (body-only), e.g. the migrated grammar intro. */
  title: text({ mode: 'json' }).$type<MultiString>(),
  /** Main documentation prose as markdown, per analysis language. */
  body: text({ mode: 'json' }).$type<MultiString>(),
  /** "When to include vs omit this form" prose as markdown, per analysis language — distinct from `body`. */
  usage_conditions: text({ mode: 'json' }).$type<MultiString>(),
  slot_id: text().references(() => clause_slots.id, { onDelete: 'set null' }),
  entry_id: text().references(() => entries.id, { onDelete: 'set null' }),
  sense_id: text().references(() => senses.id, { onDelete: 'set null' }),
  dirty: integer(),
  server_seq: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Grammar examples as REFERENCES into existing `sentences` (not re-typed copies)
 * — one sentence then serves reading (in a text), a sense's example, AND grammar
 * evidence at once, inheriting its tokens (tappable), media timings (listenable),
 * and source citation for free. Mirrors `senses_in_sentences` + ordering.
 */
export const section_sentences = sqliteTable('section_sentences', {
  id: text().primaryKey(),
  section_id: text().notNull().references(() => grammar_sections.id, { onDelete: 'cascade' }),
  sentence_id: text().notNull().references(() => sentences.id, { onDelete: 'cascade' }),
  /** Fractional index ordering examples WITHIN a section. */
  sort_key: text(),
  dirty: integer(),
  server_seq: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Text classification tags (motif / genre / tale-type): the `text` ↔ `tag`
 * junction, mirroring `entry_tags`. The tag's `kind` + `code` carry the
 * controlled classification (e.g. an ATU/Thompson motif index).
 */
export const text_tags = sqliteTable('text_tags', {
  id: text().primaryKey(),
  text_id: text().notNull().references(() => texts.id, { onDelete: 'cascade' }),
  tag_id: text().notNull().references(() => tags.id, { onDelete: 'cascade' }),
  dirty: integer(),
  server_seq: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Which dialect(s)/varieties a text is written in — the `text` ↔ `dialect`
 * junction, mirroring `entry_dialects`. With `texts.work_id` grouping, this
 * carries the per-version variety metadata of parallel texts.
 */
export const text_dialects = sqliteTable('text_dialects', {
  id: text().primaryKey(),
  text_id: text().notNull().references(() => texts.id, { onDelete: 'cascade' }),
  dialect_id: text().notNull().references(() => dialects.id, { onDelete: 'cascade' }),
  dirty: integer(),
  server_seq: integer(),
  created_by_user_id: text().notNull(),
  created_at: text().notNull(),
  updated_by_user_id: text().notNull(),
  updated_at: text().notNull(),
})
