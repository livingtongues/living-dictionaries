------------------------------------------------------------------
-- Typed entry-to-entry (optionally sense-to-sense) relationships, intra-dict.
-- See .issues/entry-relationships.md.
--
-- `entry_relationships` is ONE polymorphic table: from_entry_id/to_entry_id are
-- required; from_sense_id/to_sense_id optional (NULL = whole-entry link, set =
-- narrowed to a meaning). `type` holds a global slug (constants RELATIONSHIP_TYPES)
-- XOR `custom_type_id` references a per-dict `relationship_types` row.
--
-- This migration:
--   1. adds the `relationship_types` registry (found-or-created, like tags),
--   2. adds the `entry_relationships` table + dedupe / lookup indexes,
--   3. adds `last_modified_at` bump triggers for both,
--   4. re-declares `process_delete_cascade` to also hard-delete the two tables.
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS relationship_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,        -- JSON MultiString
  inverse_name TEXT,         -- JSON MultiString (directed custom types)
  symmetric INTEGER,         -- 1 = symmetric; NULL/0 = directed
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS entry_relationships (
  id TEXT PRIMARY KEY,
  from_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  from_sense_id TEXT REFERENCES senses(id) ON DELETE CASCADE,
  to_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  to_sense_id TEXT REFERENCES senses(id) ON DELETE CASCADE,
  type TEXT,                 -- global relationship-type slug
  custom_type_id TEXT REFERENCES relationship_types(id) ON DELETE CASCADE,
  note TEXT,                 -- JSON MultiString
  sources TEXT,              -- JSON string[] of source slugs
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((type IS NOT NULL) + (custom_type_id IS NOT NULL) = 1)
);

-- Dedupe natural key. NULLs are distinct in a plain UNIQUE, so COALESCE the
-- nullable columns to '' so entry-level (NULL-sense) duplicates collide too.
CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_relationships_natural
  ON entry_relationships(
    from_entry_id, COALESCE(from_sense_id, ''), to_entry_id, COALESCE(to_sense_id, ''),
    COALESCE(type, ''), COALESCE(custom_type_id, ''));
CREATE INDEX IF NOT EXISTS idx_entry_relationships_from ON entry_relationships(from_entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_relationships_to ON entry_relationships(to_entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_relationships_updated_at ON entry_relationships(updated_at);

-- relationship_types — last_modified_at bump (sync cursor)
CREATE TRIGGER IF NOT EXISTS relationship_types_after_insert_bump_lmod
AFTER INSERT ON relationship_types BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS relationship_types_after_update_bump_lmod
AFTER UPDATE ON relationship_types BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- entry_relationships — last_modified_at bump (sync cursor)
CREATE TRIGGER IF NOT EXISTS entry_relationships_after_insert_bump_lmod
AFTER INSERT ON entry_relationships BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS entry_relationships_after_update_bump_lmod
AFTER UPDATE ON entry_relationships BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- SQLite has no ALTER TRIGGER: re-declare the whole hard-delete cascade with the
-- `relationship_types` + `entry_relationships` lines added. Stays byte-identical
-- to 20260701_sources's trigger except for the two new DELETE lines.
DROP TRIGGER IF EXISTS process_delete_cascade;
CREATE TRIGGER process_delete_cascade AFTER INSERT ON deletes
BEGIN
  DELETE FROM entries             WHERE id = NEW.id AND NEW.table_name = 'entries';
  DELETE FROM texts               WHERE id = NEW.id AND NEW.table_name = 'texts';
  DELETE FROM senses              WHERE id = NEW.id AND NEW.table_name = 'senses';
  DELETE FROM sentences           WHERE id = NEW.id AND NEW.table_name = 'sentences';
  DELETE FROM senses_in_sentences WHERE id = NEW.id AND NEW.table_name = 'senses_in_sentences';
  DELETE FROM speakers            WHERE id = NEW.id AND NEW.table_name = 'speakers';
  DELETE FROM audio               WHERE id = NEW.id AND NEW.table_name = 'audio';
  DELETE FROM audio_speakers      WHERE id = NEW.id AND NEW.table_name = 'audio_speakers';
  DELETE FROM videos              WHERE id = NEW.id AND NEW.table_name = 'videos';
  DELETE FROM video_speakers      WHERE id = NEW.id AND NEW.table_name = 'video_speakers';
  DELETE FROM sense_videos        WHERE id = NEW.id AND NEW.table_name = 'sense_videos';
  DELETE FROM sentence_videos     WHERE id = NEW.id AND NEW.table_name = 'sentence_videos';
  DELETE FROM photos              WHERE id = NEW.id AND NEW.table_name = 'photos';
  DELETE FROM sense_photos        WHERE id = NEW.id AND NEW.table_name = 'sense_photos';
  DELETE FROM sentence_photos     WHERE id = NEW.id AND NEW.table_name = 'sentence_photos';
  DELETE FROM dialects            WHERE id = NEW.id AND NEW.table_name = 'dialects';
  DELETE FROM entry_dialects      WHERE id = NEW.id AND NEW.table_name = 'entry_dialects';
  DELETE FROM tags                WHERE id = NEW.id AND NEW.table_name = 'tags';
  DELETE FROM entry_tags          WHERE id = NEW.id AND NEW.table_name = 'entry_tags';
  DELETE FROM sources             WHERE id = NEW.id AND NEW.table_name = 'sources';
  DELETE FROM relationship_types  WHERE id = NEW.id AND NEW.table_name = 'relationship_types';
  DELETE FROM entry_relationships WHERE id = NEW.id AND NEW.table_name = 'entry_relationships';
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
