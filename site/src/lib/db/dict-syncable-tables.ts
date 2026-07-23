/**
 * Names of all syncable tables in a dictionary.db, in FK-safe order (parents
 * before children). One sector per spec (Q-shared.3 in
 * port-db-sync-architecture.md) — every push/pull processes all tables in this
 * order.
 *
 * CLIENT-SAFE: this is a plain constant with NO imports, deliberately split out
 * of `db/server/dictionary-sync-helpers.ts` (which pulls in better-sqlite3 via
 * the history-capture chain). The browser dict-client (`dict-live-db`,
 * `dict-sync-engine`, `dict-writes`) imports the VALUE from here so the
 * server-only native module never leaks into the client bundle — a value import
 * from the server file dragged all of better-sqlite3 into the `[dictionaryId]`
 * layout chunk and crashed every dictionary open ("i is not a function").
 *
 * Order is FK-safe:
 *   entries, texts → senses → senses_in_sentences
 *   sentences (references texts; also referenced by senses_in_sentences)
 *   speakers, audio, videos, photos (top-level media; audio/videos reference texts)
 *   then junctions
 *   clause_slots, glossing_abbreviations (vocab, no deps) →
 *   grammar_sections (references entries, senses, clause_slots, self) →
 *   section_sentences (references grammar_sections + sentences),
 *   text_tags (references texts + tags),
 *   text_dialects (references texts + dialects),
 *   ignored_forms (no deps — dictionary-level matcher ignore list)
 */
export const DICT_SYNCABLE_TABLES = [
  'entries',
  'texts',
  'sentences',
  'senses',
  'senses_in_sentences',
  'speakers',
  'audio',
  'audio_speakers',
  'videos',
  'video_speakers',
  'sense_videos',
  'sentence_videos',
  'photos',
  'sense_photos',
  'sentence_photos',
  'dialects',
  'entry_dialects',
  'tags',
  'entry_tags',
  'sources',
  'relationship_types',
  'entry_relationships',
  'featured_entries',
  'clause_slots',
  'glossing_abbreviations',
  'grammar_sections',
  'section_sentences',
  'text_tags',
  'text_dialects',
  'ignored_forms',
] as const

export type DictSyncableTable = typeof DICT_SYNCABLE_TABLES[number]
