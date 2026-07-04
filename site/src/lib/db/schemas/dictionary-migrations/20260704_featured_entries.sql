-- Per-dictionary featured entries: editor-curated favorites shown on the
-- dictionary home page, ordered by `sort_key` (fractional index, same scheme
-- as sentences.sort_key). One row per entry (UNIQUE natural key, junction
-- convention: synthetic UUID PK + UNIQUE on natural key — the UNIQUE's
-- entry_id column doubles as the FK-cascade lookup index).
--
-- NOT the same thing as shared.db's `featured_entries` (the admin-curated
-- GLOBAL homepage showcase) — this table is dict-scoped, synced to every
-- client, and feeds both the dict home strip and (via the curate command's
-- editor-star sweep) the global curation bucket.
CREATE TABLE IF NOT EXISTS featured_entries (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  sort_key TEXT NOT NULL, -- fractional index (LexoRank-style), see $lib/api/v1/fractional-index.ts
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (entry_id)
);
CREATE INDEX IF NOT EXISTS idx_featured_entries_sort ON featured_entries(sort_key);
CREATE INDEX IF NOT EXISTS idx_featured_entries_updated_at ON featured_entries(updated_at);

-- Sync-cursor bump triggers (one INSERT + one UPDATE per syncable table).
CREATE TRIGGER IF NOT EXISTS featured_entries_after_insert_bump_lmod
AFTER INSERT ON featured_entries BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS featured_entries_after_update_bump_lmod
AFTER UPDATE ON featured_entries BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- Re-declare the hard-delete cascade with the new table included (DROP +
-- CREATE so every DB converges on the same trigger body — same pattern as the
-- initial migration).
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
  DELETE FROM featured_entries    WHERE id = NEW.id AND NEW.table_name = 'featured_entries';
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
