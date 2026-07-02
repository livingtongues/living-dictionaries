-- Repair: re-declare `process_delete_cascade` (byte-identical to the final
-- 20260701b version). During 20260701b's development window, dev servers and
-- dev-window browser clients applied an EARLY DRAFT of that file (before its
-- trigger re-declaration existed) and recorded the migration as applied — so
-- their live trigger is still the 20260701_sources version and hard-deletes of
-- `relationship_types` / `entry_relationships` silently no-op (the tombstone
-- lands in `deletes` but the row survives). Re-running the exact declaration is
-- idempotent for healthy DBs and fixes stale ones.
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

-- Sweep rows whose tombstone landed while the trigger was stale: the tombstone
-- is already in `deletes`, so a retried delete is an `INSERT OR IGNORE` no-op
-- and the trigger never re-fires — without this sweep those rows are
-- permanently undeletable. No-op on healthy DBs.
DELETE FROM relationship_types  WHERE id IN (SELECT id FROM deletes WHERE table_name = 'relationship_types');
DELETE FROM entry_relationships WHERE id IN (SELECT id FROM deletes WHERE table_name = 'entry_relationships');
