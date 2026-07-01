------------------------------------------------------------------
-- Structured sources: per-dict citation registry + slug-array refs on
-- entries/sentences/texts. See .issues/sources-model.md.
--
-- `entries.sources` already exists (a JSON string[] column). This migration:
--   1. adds the `sources` registry table,
--   2. adds matching `sources` slug-array columns to `sentences` + `texts`,
--   3. adds the `last_modified_at` bump triggers for `sources`,
--   4. re-declares `process_delete_cascade` to also hard-delete `sources`.
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  citation TEXT,
  abbreviation TEXT,
  author TEXT,
  year TEXT,
  url TEXT,
  license TEXT,
  type TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_slug ON sources(slug);
CREATE INDEX IF NOT EXISTS idx_sources_updated_at ON sources(updated_at);

-- Slug-array (JSON string[], stored as TEXT) references on sentences + texts.
-- Entries already carry `sources`. SQLite ADD COLUMN is safe for a nullable col.
ALTER TABLE sentences ADD COLUMN sources TEXT;
ALTER TABLE texts ADD COLUMN sources TEXT;

-- sources — last_modified_at bump (sync cursor)
CREATE TRIGGER IF NOT EXISTS sources_after_insert_bump_lmod
AFTER INSERT ON sources BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS sources_after_update_bump_lmod
AFTER UPDATE ON sources BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- SQLite has no ALTER TRIGGER: re-declare the whole hard-delete cascade with the
-- `sources` line added. Must stay byte-identical to 20260606_initial's trigger
-- except for the new DELETE FROM sources line.
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
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
