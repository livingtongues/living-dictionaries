import type { SchemaInfo } from '$lib/db/introspect'

// Shorthand column factory so the mock stays readable.
type Col = SchemaInfo['tables'][number]['columns'][number]
function c(name: string, opts: Partial<Col> = {}): Col {
  return { name, type: 'TEXT', not_null: false, default_value: null, pk_order: 0, is_unique: false, is_foreign_key: false, ...opts }
}

/**
 * Living-Dictionaries-flavored mock schema for visual stories of the schema
 * viewer's graph. Mirrors the real dictionary-db
 * shape closely enough to exercise: FKs/edges, a junction table (`sense_photos`),
 * a unique column, a partial index, a system table (`migrations`), a view, and a
 * trigger.
 */
export const mock_schema: SchemaInfo = {
  source_label: 'server dictionary.db',
  tables: [
    {
      name: 'entries',
      raw_sql: `CREATE TABLE entries (\n  id TEXT PRIMARY KEY,\n  lexeme TEXT NOT NULL,\n  phonetic TEXT,\n  dialect_id TEXT REFERENCES dialects(id) ON DELETE SET NULL,\n  dirty INTEGER,\n  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n  updated_at TEXT NOT NULL\n)`,
      columns: [
        c('id', { pk_order: 1 }),
        c('lexeme', { not_null: true }),
        c('phonetic'),
        c('dialect_id', { is_foreign_key: true }),
        c('dirty', { type: 'INTEGER' }),
        c('created_at', { not_null: true, default_value: `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` }),
        c('updated_at', { not_null: true }),
      ],
      primary_key_columns: ['id'],
      foreign_keys: [
        { column: 'dialect_id', target_table: 'dialects', target_column: 'id', on_delete: 'SET NULL', on_update: 'NO ACTION' },
      ],
      indexes: [
        { name: 'idx_entries_lexeme', unique: false, columns: ['lexeme'], partial_where: null, origin: 'c' },
        { name: 'idx_entries_dirty', unique: false, columns: ['dirty'], partial_where: 'dirty IS NOT NULL', origin: 'c' },
      ],
      triggers: [],
      row_count: 4821,
    },
    {
      name: 'senses',
      raw_sql: 'CREATE TABLE senses (\n  id TEXT PRIMARY KEY,\n  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,\n  glosses TEXT,\n  parts_of_speech TEXT,\n  position INTEGER NOT NULL\n)',
      columns: [
        c('id', { pk_order: 1 }),
        c('entry_id', { is_foreign_key: true, not_null: true }),
        c('glosses'),
        c('parts_of_speech'),
        c('position', { type: 'INTEGER', not_null: true }),
      ],
      primary_key_columns: ['id'],
      foreign_keys: [
        { column: 'entry_id', target_table: 'entries', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
      ],
      indexes: [
        { name: 'idx_senses_entry', unique: false, columns: ['entry_id', 'position'], partial_where: null, origin: 'c' },
      ],
      triggers: [],
      row_count: 6190,
    },
    {
      name: 'sentences',
      raw_sql: 'CREATE TABLE sentences (\n  id TEXT PRIMARY KEY,\n  text TEXT NOT NULL,\n  translation TEXT\n)',
      columns: [c('id', { pk_order: 1 }), c('text', { not_null: true }), c('translation')],
      primary_key_columns: ['id'],
      foreign_keys: [],
      indexes: [],
      triggers: [],
      row_count: 1377,
    },
    {
      name: 'senses_in_sentences',
      raw_sql: 'CREATE TABLE senses_in_sentences (\n  id TEXT PRIMARY KEY,\n  sense_id TEXT REFERENCES senses(id) ON DELETE CASCADE,\n  sentence_id TEXT REFERENCES sentences(id) ON DELETE CASCADE,\n  position INTEGER NOT NULL,\n  dirty INTEGER,\n  created_at TEXT,\n  updated_at TEXT\n)',
      columns: [
        c('id', { pk_order: 1 }),
        c('sense_id', { is_foreign_key: true, not_null: true }),
        c('sentence_id', { is_foreign_key: true, not_null: true }),
        c('position', { type: 'INTEGER', not_null: true }),
        c('dirty', { type: 'INTEGER' }),
        c('created_at', { not_null: true }),
        c('updated_at', { not_null: true }),
      ],
      primary_key_columns: ['id'],
      foreign_keys: [
        { column: 'sense_id', target_table: 'senses', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
        { column: 'sentence_id', target_table: 'sentences', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
      ],
      indexes: [],
      triggers: [],
      row_count: 2044,
    },
    {
      name: 'photos',
      raw_sql: 'CREATE TABLE photos (\n  id TEXT PRIMARY KEY,\n  storage_path TEXT NOT NULL,\n  caption TEXT\n)',
      columns: [c('id', { pk_order: 1 }), c('storage_path', { not_null: true }), c('caption')],
      primary_key_columns: ['id'],
      foreign_keys: [],
      indexes: [
        { name: 'idx_photos_storage_path', unique: true, columns: ['storage_path'], partial_where: null, origin: 'c' },
      ],
      triggers: [],
      row_count: 932,
    },
    // JUNCTION — id-PK + 2 FKs + position + system cols (sync-friendly join shape).
    {
      name: 'sense_photos',
      raw_sql: 'CREATE TABLE sense_photos (\n  id TEXT PRIMARY KEY,\n  sense_id TEXT REFERENCES senses(id) ON DELETE CASCADE,\n  photo_id TEXT REFERENCES photos(id) ON DELETE CASCADE,\n  position INTEGER NOT NULL,\n  dirty INTEGER,\n  created_at TEXT,\n  updated_at TEXT\n)',
      columns: [
        c('id', { pk_order: 1 }),
        c('sense_id', { is_foreign_key: true, not_null: true }),
        c('photo_id', { is_foreign_key: true, not_null: true }),
        c('position', { type: 'INTEGER', not_null: true }),
        c('dirty', { type: 'INTEGER' }),
        c('created_at', { not_null: true }),
        c('updated_at', { not_null: true }),
      ],
      primary_key_columns: ['id'],
      foreign_keys: [
        { column: 'sense_id', target_table: 'senses', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
        { column: 'photo_id', target_table: 'photos', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
      ],
      indexes: [],
      triggers: [],
      row_count: 1488,
    },
    {
      name: 'videos',
      raw_sql: 'CREATE TABLE videos (\n  id TEXT PRIMARY KEY,\n  storage_path TEXT NOT NULL\n)',
      columns: [c('id', { pk_order: 1 }), c('storage_path', { not_null: true })],
      primary_key_columns: ['id'],
      foreign_keys: [],
      indexes: [],
      triggers: [],
      row_count: 211,
    },
    {
      name: 'speakers',
      raw_sql: 'CREATE TABLE speakers (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL,\n  birthplace TEXT\n)',
      columns: [c('id', { pk_order: 1 }), c('name', { not_null: true }), c('birthplace')],
      primary_key_columns: ['id'],
      foreign_keys: [],
      indexes: [],
      triggers: [],
      row_count: 47,
    },
    // JUNCTION — id-PK + 2 FKs (no payload).
    {
      name: 'video_speakers',
      raw_sql: 'CREATE TABLE video_speakers (\n  id TEXT PRIMARY KEY,\n  video_id TEXT REFERENCES videos(id) ON DELETE CASCADE,\n  speaker_id TEXT REFERENCES speakers(id) ON DELETE CASCADE,\n  dirty INTEGER,\n  created_at TEXT,\n  updated_at TEXT\n)',
      columns: [
        c('id', { pk_order: 1 }),
        c('video_id', { is_foreign_key: true, not_null: true }),
        c('speaker_id', { is_foreign_key: true, not_null: true }),
        c('dirty', { type: 'INTEGER' }),
        c('created_at', { not_null: true }),
        c('updated_at', { not_null: true }),
      ],
      primary_key_columns: ['id'],
      foreign_keys: [
        { column: 'video_id', target_table: 'videos', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
        { column: 'speaker_id', target_table: 'speakers', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
      ],
      indexes: [],
      triggers: [],
      row_count: 63,
    },
    {
      name: 'dialects',
      raw_sql: 'CREATE TABLE dialects (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL\n)',
      columns: [c('id', { pk_order: 1 }), c('name', { not_null: true })],
      primary_key_columns: ['id'],
      foreign_keys: [],
      indexes: [],
      triggers: [
        { name: 'touch_dialect_updated', table_name: 'dialects', raw_sql: 'CREATE TRIGGER touch_dialect_updated AFTER UPDATE ON dialects\nBEGIN\n  UPDATE dialects SET updated_at = (strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')) WHERE id = NEW.id;\nEND' },
      ],
      row_count: 6,
    },
    // SYSTEM table — hidden by default in the graph's "hide system tables" toggle.
    {
      name: 'migrations',
      raw_sql: 'CREATE TABLE migrations (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL,\n  run_on TEXT NOT NULL\n)',
      columns: [c('id', { pk_order: 1 }), c('name', { not_null: true }), c('run_on', { not_null: true })],
      primary_key_columns: ['id'],
      foreign_keys: [],
      indexes: [],
      triggers: [],
      row_count: 1,
    },
  ],
  views: [
    {
      name: 'entry_overview',
      raw_sql: 'CREATE VIEW entry_overview AS\n  SELECT e.id, e.lexeme, COUNT(s.id) AS sense_count\n  FROM entries e LEFT JOIN senses s ON s.entry_id = e.id\n  GROUP BY e.id',
    },
  ],
  triggers: [
    { name: 'touch_dialect_updated', table_name: 'dialects', raw_sql: 'CREATE TRIGGER touch_dialect_updated AFTER UPDATE ON dialects\nBEGIN\n  UPDATE dialects SET updated_at = (strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')) WHERE id = NEW.id;\nEND' },
  ],
}
