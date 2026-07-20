-- v1 API quick wins (.issues/v1-api-quick-wins.md): small additive fields from
-- agent-importer feedback.
--
-- New columns on existing tables:
--   entries.homograph  — printed-dictionary homograph number ("1", "2", also "a"/"b");
--                        distinguishes deliberately identical headwords from accidental dupes
--   entries.citations  — JSON SourceCitation[] ({slug, locator}) — per-entry page/example
--                        loci, mirroring sentences.citations
--   senses.sources     — JSON string[] of sources.slug refs — per-sense provenance when
--                        senses are merged onto one entry from several sources
--   texts.citations    — JSON SourceCitation[] — text-level citation loci
--   texts.summary      — JSON MultiString — a synopsis/abstract of the text
--   texts.work_id      — nullable grouping key: texts sharing a work_id are versions of
--                        ONE work (parallel texts across dialects — hymnal/scripture)
--
-- New syncable table:
--   text_dialects — text ↔ dialect junction (which variety a text version is in),
--                   mirroring entry_dialects/text_tags conventions.

ALTER TABLE entries ADD COLUMN homograph TEXT;
ALTER TABLE entries ADD COLUMN citations TEXT; -- JSON SourceCitation[]
ALTER TABLE senses ADD COLUMN sources TEXT;    -- JSON string[] of sources.slug refs
ALTER TABLE texts ADD COLUMN citations TEXT;   -- JSON SourceCitation[]
ALTER TABLE texts ADD COLUMN summary TEXT;     -- JSON MultiString
ALTER TABLE texts ADD COLUMN work_id TEXT;

CREATE INDEX IF NOT EXISTS idx_texts_work ON texts(work_id);

------------------------------------------------------------------
-- text_dialects (junction, mirrors entry_dialects)
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS text_dialects (
  id TEXT PRIMARY KEY,
  text_id TEXT NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  dialect_id TEXT NOT NULL REFERENCES dialects(id) ON DELETE CASCADE,
  dirty INTEGER,
  server_seq INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (text_id, dialect_id)
);
CREATE INDEX IF NOT EXISTS idx_text_dialects_dialect ON text_dialects(dialect_id);
CREATE INDEX IF NOT EXISTS idx_text_dialects_updated_at ON text_dialects(updated_at);
CREATE INDEX IF NOT EXISTS idx_text_dialects_server_seq ON text_dialects(server_seq);

------------------------------------------------------------------
-- Sync-cursor bump triggers (db_metadata.last_modified_at)
------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS text_dialects_after_insert_bump_lmod
AFTER INSERT ON text_dialects BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS text_dialects_after_update_bump_lmod
AFTER UPDATE ON text_dialects BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

------------------------------------------------------------------
-- server_seq triggers (strictly-monotonic per-DB sync cursor)
------------------------------------------------------------------
DROP TRIGGER IF EXISTS text_dialects_server_seq_ai;
CREATE TRIGGER text_dialects_server_seq_ai AFTER INSERT ON text_dialects
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE text_dialects SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;
DROP TRIGGER IF EXISTS text_dialects_server_seq_au;
CREATE TRIGGER text_dialects_server_seq_au AFTER UPDATE ON text_dialects
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE text_dialects SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- Re-declare the hard-delete cascade with text_dialects included (DROP +
-- CREATE so every DB converges on the same trigger body).
------------------------------------------------------------------
DROP TRIGGER IF EXISTS process_delete_cascade;
CREATE TRIGGER process_delete_cascade AFTER INSERT ON deletes
BEGIN
  DELETE FROM entries                WHERE id = NEW.id AND NEW.table_name = 'entries';
  DELETE FROM texts                  WHERE id = NEW.id AND NEW.table_name = 'texts';
  DELETE FROM senses                 WHERE id = NEW.id AND NEW.table_name = 'senses';
  DELETE FROM sentences              WHERE id = NEW.id AND NEW.table_name = 'sentences';
  DELETE FROM senses_in_sentences    WHERE id = NEW.id AND NEW.table_name = 'senses_in_sentences';
  DELETE FROM speakers               WHERE id = NEW.id AND NEW.table_name = 'speakers';
  DELETE FROM audio                  WHERE id = NEW.id AND NEW.table_name = 'audio';
  DELETE FROM audio_speakers         WHERE id = NEW.id AND NEW.table_name = 'audio_speakers';
  DELETE FROM videos                 WHERE id = NEW.id AND NEW.table_name = 'videos';
  DELETE FROM video_speakers         WHERE id = NEW.id AND NEW.table_name = 'video_speakers';
  DELETE FROM sense_videos           WHERE id = NEW.id AND NEW.table_name = 'sense_videos';
  DELETE FROM sentence_videos        WHERE id = NEW.id AND NEW.table_name = 'sentence_videos';
  DELETE FROM photos                 WHERE id = NEW.id AND NEW.table_name = 'photos';
  DELETE FROM sense_photos           WHERE id = NEW.id AND NEW.table_name = 'sense_photos';
  DELETE FROM sentence_photos        WHERE id = NEW.id AND NEW.table_name = 'sentence_photos';
  DELETE FROM dialects               WHERE id = NEW.id AND NEW.table_name = 'dialects';
  DELETE FROM entry_dialects         WHERE id = NEW.id AND NEW.table_name = 'entry_dialects';
  DELETE FROM tags                   WHERE id = NEW.id AND NEW.table_name = 'tags';
  DELETE FROM entry_tags             WHERE id = NEW.id AND NEW.table_name = 'entry_tags';
  DELETE FROM sources                WHERE id = NEW.id AND NEW.table_name = 'sources';
  DELETE FROM relationship_types     WHERE id = NEW.id AND NEW.table_name = 'relationship_types';
  DELETE FROM entry_relationships    WHERE id = NEW.id AND NEW.table_name = 'entry_relationships';
  DELETE FROM featured_entries       WHERE id = NEW.id AND NEW.table_name = 'featured_entries';
  DELETE FROM clause_slots           WHERE id = NEW.id AND NEW.table_name = 'clause_slots';
  DELETE FROM glossing_abbreviations WHERE id = NEW.id AND NEW.table_name = 'glossing_abbreviations';
  DELETE FROM grammar_sections       WHERE id = NEW.id AND NEW.table_name = 'grammar_sections';
  DELETE FROM section_sentences      WHERE id = NEW.id AND NEW.table_name = 'section_sentences';
  DELETE FROM text_tags              WHERE id = NEW.id AND NEW.table_name = 'text_tags';
  DELETE FROM text_dialects          WHERE id = NEW.id AND NEW.table_name = 'text_dialects';
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
