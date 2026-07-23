------------------------------------------------------------------
-- ignored_forms — dictionary-level "ignore everywhere" decisions.
-- `form` is the NORMALIZED word key (see corpus/tokenize-sentence
-- `normalized_word_key`). The matcher consults this set on ingest and
-- re-analyze so ignored function words / numerals / names stay ignored in
-- future texts instead of resurfacing in the suggestions queue.
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ignored_forms (
  id TEXT PRIMARY KEY,
  form TEXT NOT NULL,
  dirty INTEGER,
  server_seq INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (form)
);
CREATE INDEX IF NOT EXISTS idx_ignored_forms_updated_at ON ignored_forms(updated_at);
CREATE INDEX IF NOT EXISTS idx_ignored_forms_server_seq ON ignored_forms(server_seq);

------------------------------------------------------------------
-- Sync-cursor bump triggers (db_metadata.last_modified_at)
------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS ignored_forms_after_insert_bump_lmod
AFTER INSERT ON ignored_forms BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS ignored_forms_after_update_bump_lmod
AFTER UPDATE ON ignored_forms BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

------------------------------------------------------------------
-- server_seq triggers (strictly-monotonic per-DB sync cursor)
------------------------------------------------------------------
DROP TRIGGER IF EXISTS ignored_forms_server_seq_ai;
CREATE TRIGGER ignored_forms_server_seq_ai AFTER INSERT ON ignored_forms
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE ignored_forms SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;
DROP TRIGGER IF EXISTS ignored_forms_server_seq_au;
CREATE TRIGGER ignored_forms_server_seq_au AFTER UPDATE ON ignored_forms
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE ignored_forms SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- Re-declare the hard-delete cascade with ignored_forms included (DROP +
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
  DELETE FROM ignored_forms          WHERE id = NEW.id AND NEW.table_name = 'ignored_forms';
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
