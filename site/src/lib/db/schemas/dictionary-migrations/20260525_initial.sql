-- Initial migration for `dictionaries/{id}.db`. Runs on:
--   1. The server's per-dict better-sqlite3 file (via `get_dictionary_db()`)
--   2. The R2 snapshot pipeline (snapshot is built FROM the server's file, so
--      this migration's tables are what viewers pull down)
--   3. Every client's wa-sqlite OPFS instance (via the SharedWorker — pending
--      Story B.1 implementation; for now applied server-side only)
--
-- Conventions (per port-db-sync-architecture.md):
--   - Every content table has `deleted TEXT` (NULL = visible).
--   - Every content table has `dirty INTEGER` (NULL/0 = clean, 1 = pending push).
--   - Every junction table has synthetic UUID PK + UNIQUE on natural key.
--   - `last_modified_at` triggers fan out on every syncable table.

CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  run_on TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS db_metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Tombstones — INSERT INTO deletes(table_name, id) fires the
-- `process_delete_cascade` trigger to soft-delete the matching row.
CREATE TABLE IF NOT EXISTS deletes (
  table_name TEXT NOT NULL,
  id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (table_name, id)
);
CREATE INDEX IF NOT EXISTS idx_deletes_table_updated_at ON deletes(table_name, updated_at);

------------------------------------------------------------------
-- Content tables
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  lexeme TEXT NOT NULL, -- JSON MultiString
  phonetic TEXT,
  interlinearization TEXT,
  morphology TEXT,
  notes TEXT, -- JSON MultiString
  sources TEXT, -- JSON string[]
  scientific_names TEXT, -- JSON string[]
  coordinates TEXT, -- JSON
  unsupported_fields TEXT, -- JSON
  elicitation_id TEXT,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at);
CREATE INDEX IF NOT EXISTS idx_entries_deleted ON entries(deleted) WHERE deleted IS NULL;

CREATE TABLE IF NOT EXISTS senses (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  definition TEXT,
  glosses TEXT,
  parts_of_speech TEXT,
  semantic_domains TEXT,
  write_in_semantic_domains TEXT,
  noun_class TEXT,
  plural_form TEXT,
  variant TEXT,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_senses_entry ON senses(entry_id);
CREATE INDEX IF NOT EXISTS idx_senses_updated_at ON senses(updated_at);

CREATE TABLE IF NOT EXISTS sentences (
  id TEXT PRIMARY KEY,
  text TEXT,
  translation TEXT,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_sentences_updated_at ON sentences(updated_at);

CREATE TABLE IF NOT EXISTS senses_in_sentences (
  id TEXT PRIMARY KEY,
  sense_id TEXT NOT NULL REFERENCES senses(id) ON DELETE CASCADE,
  sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (sense_id, sentence_id)
);
CREATE INDEX IF NOT EXISTS idx_senses_in_sentences_sense ON senses_in_sentences(sense_id);
CREATE INDEX IF NOT EXISTS idx_senses_in_sentences_sentence ON senses_in_sentences(sentence_id);
CREATE INDEX IF NOT EXISTS idx_senses_in_sentences_updated_at ON senses_in_sentences(updated_at);

CREATE TABLE IF NOT EXISTS speakers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  decade INTEGER,
  gender TEXT, -- 'm' | 'f' | 'o'
  birthplace TEXT,
  user_id TEXT,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_speakers_updated_at ON speakers(updated_at);

CREATE TABLE IF NOT EXISTS audio (
  id TEXT PRIMARY KEY,
  entry_id TEXT REFERENCES entries(id) ON DELETE CASCADE,
  sentence_id TEXT REFERENCES sentences(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  source TEXT,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_audio_entry ON audio(entry_id);
CREATE INDEX IF NOT EXISTS idx_audio_sentence ON audio(sentence_id);
CREATE INDEX IF NOT EXISTS idx_audio_updated_at ON audio(updated_at);

CREATE TABLE IF NOT EXISTS audio_speakers (
  id TEXT PRIMARY KEY,
  audio_id TEXT NOT NULL REFERENCES audio(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (audio_id, speaker_id)
);
CREATE INDEX IF NOT EXISTS idx_audio_speakers_audio ON audio_speakers(audio_id);
CREATE INDEX IF NOT EXISTS idx_audio_speakers_speaker ON audio_speakers(speaker_id);
CREATE INDEX IF NOT EXISTS idx_audio_speakers_updated_at ON audio_speakers(updated_at);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  storage_path TEXT,
  hosted_elsewhere TEXT,
  source TEXT,
  videographer TEXT,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_videos_updated_at ON videos(updated_at);

CREATE TABLE IF NOT EXISTS video_speakers (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (video_id, speaker_id)
);
CREATE INDEX IF NOT EXISTS idx_video_speakers_video ON video_speakers(video_id);
CREATE INDEX IF NOT EXISTS idx_video_speakers_speaker ON video_speakers(speaker_id);
CREATE INDEX IF NOT EXISTS idx_video_speakers_updated_at ON video_speakers(updated_at);

CREATE TABLE IF NOT EXISTS sense_videos (
  id TEXT PRIMARY KEY,
  sense_id TEXT NOT NULL REFERENCES senses(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (sense_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_sense_videos_sense ON sense_videos(sense_id);
CREATE INDEX IF NOT EXISTS idx_sense_videos_video ON sense_videos(video_id);
CREATE INDEX IF NOT EXISTS idx_sense_videos_updated_at ON sense_videos(updated_at);

CREATE TABLE IF NOT EXISTS sentence_videos (
  id TEXT PRIMARY KEY,
  sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (sentence_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_sentence_videos_sentence ON sentence_videos(sentence_id);
CREATE INDEX IF NOT EXISTS idx_sentence_videos_video ON sentence_videos(video_id);
CREATE INDEX IF NOT EXISTS idx_sentence_videos_updated_at ON sentence_videos(updated_at);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  storage_path TEXT NOT NULL,
  serving_url TEXT NOT NULL,
  source TEXT,
  photographer TEXT,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_photos_updated_at ON photos(updated_at);

CREATE TABLE IF NOT EXISTS sense_photos (
  id TEXT PRIMARY KEY,
  sense_id TEXT NOT NULL REFERENCES senses(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (sense_id, photo_id)
);
CREATE INDEX IF NOT EXISTS idx_sense_photos_sense ON sense_photos(sense_id);
CREATE INDEX IF NOT EXISTS idx_sense_photos_photo ON sense_photos(photo_id);
CREATE INDEX IF NOT EXISTS idx_sense_photos_updated_at ON sense_photos(updated_at);

CREATE TABLE IF NOT EXISTS sentence_photos (
  id TEXT PRIMARY KEY,
  sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (sentence_id, photo_id)
);
CREATE INDEX IF NOT EXISTS idx_sentence_photos_sentence ON sentence_photos(sentence_id);
CREATE INDEX IF NOT EXISTS idx_sentence_photos_photo ON sentence_photos(photo_id);
CREATE INDEX IF NOT EXISTS idx_sentence_photos_updated_at ON sentence_photos(updated_at);

CREATE TABLE IF NOT EXISTS dialects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_dialects_updated_at ON dialects(updated_at);

CREATE TABLE IF NOT EXISTS entry_dialects (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  dialect_id TEXT NOT NULL REFERENCES dialects(id) ON DELETE CASCADE,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (entry_id, dialect_id)
);
CREATE INDEX IF NOT EXISTS idx_entry_dialects_entry ON entry_dialects(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_dialects_dialect ON entry_dialects(dialect_id);
CREATE INDEX IF NOT EXISTS idx_entry_dialects_updated_at ON entry_dialects(updated_at);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  private INTEGER,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_tags_updated_at ON tags(updated_at);

CREATE TABLE IF NOT EXISTS entry_tags (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  deleted TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (entry_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_entry_tags_entry ON entry_tags(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_entry_tags_updated_at ON entry_tags(updated_at);

------------------------------------------------------------------
-- Triggers
------------------------------------------------------------------

-- `last_modified_at` is the sync cursor. Every content-table write bumps it.
-- Hand-written per Q-shared.2 — explicit + greppable; when adding a new
-- syncable table in a future migration, the table + its trigger live in the
-- same SQL file so there's one place to look.

-- Macro: a `AFTER INSERT OR UPDATE OR DELETE` trigger per syncable table.
-- Sqlite has no "OR" syntax — split into three triggers per table.

-- entries
CREATE TRIGGER IF NOT EXISTS entries_after_insert_bump_lmod
AFTER INSERT ON entries BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS entries_after_update_bump_lmod
AFTER UPDATE ON entries BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- senses
CREATE TRIGGER IF NOT EXISTS senses_after_insert_bump_lmod
AFTER INSERT ON senses BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS senses_after_update_bump_lmod
AFTER UPDATE ON senses BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- sentences
CREATE TRIGGER IF NOT EXISTS sentences_after_insert_bump_lmod
AFTER INSERT ON sentences BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS sentences_after_update_bump_lmod
AFTER UPDATE ON sentences BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- senses_in_sentences
CREATE TRIGGER IF NOT EXISTS senses_in_sentences_after_insert_bump_lmod
AFTER INSERT ON senses_in_sentences BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS senses_in_sentences_after_update_bump_lmod
AFTER UPDATE ON senses_in_sentences BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- speakers
CREATE TRIGGER IF NOT EXISTS speakers_after_insert_bump_lmod
AFTER INSERT ON speakers BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS speakers_after_update_bump_lmod
AFTER UPDATE ON speakers BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- audio
CREATE TRIGGER IF NOT EXISTS audio_after_insert_bump_lmod
AFTER INSERT ON audio BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS audio_after_update_bump_lmod
AFTER UPDATE ON audio BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- audio_speakers
CREATE TRIGGER IF NOT EXISTS audio_speakers_after_insert_bump_lmod
AFTER INSERT ON audio_speakers BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS audio_speakers_after_update_bump_lmod
AFTER UPDATE ON audio_speakers BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- videos
CREATE TRIGGER IF NOT EXISTS videos_after_insert_bump_lmod
AFTER INSERT ON videos BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS videos_after_update_bump_lmod
AFTER UPDATE ON videos BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- video_speakers
CREATE TRIGGER IF NOT EXISTS video_speakers_after_insert_bump_lmod
AFTER INSERT ON video_speakers BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS video_speakers_after_update_bump_lmod
AFTER UPDATE ON video_speakers BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- sense_videos
CREATE TRIGGER IF NOT EXISTS sense_videos_after_insert_bump_lmod
AFTER INSERT ON sense_videos BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS sense_videos_after_update_bump_lmod
AFTER UPDATE ON sense_videos BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- sentence_videos
CREATE TRIGGER IF NOT EXISTS sentence_videos_after_insert_bump_lmod
AFTER INSERT ON sentence_videos BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS sentence_videos_after_update_bump_lmod
AFTER UPDATE ON sentence_videos BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- photos
CREATE TRIGGER IF NOT EXISTS photos_after_insert_bump_lmod
AFTER INSERT ON photos BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS photos_after_update_bump_lmod
AFTER UPDATE ON photos BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- sense_photos
CREATE TRIGGER IF NOT EXISTS sense_photos_after_insert_bump_lmod
AFTER INSERT ON sense_photos BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS sense_photos_after_update_bump_lmod
AFTER UPDATE ON sense_photos BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- sentence_photos
CREATE TRIGGER IF NOT EXISTS sentence_photos_after_insert_bump_lmod
AFTER INSERT ON sentence_photos BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS sentence_photos_after_update_bump_lmod
AFTER UPDATE ON sentence_photos BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- dialects
CREATE TRIGGER IF NOT EXISTS dialects_after_insert_bump_lmod
AFTER INSERT ON dialects BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS dialects_after_update_bump_lmod
AFTER UPDATE ON dialects BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- entry_dialects
CREATE TRIGGER IF NOT EXISTS entry_dialects_after_insert_bump_lmod
AFTER INSERT ON entry_dialects BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS entry_dialects_after_update_bump_lmod
AFTER UPDATE ON entry_dialects BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- tags
CREATE TRIGGER IF NOT EXISTS tags_after_insert_bump_lmod
AFTER INSERT ON tags BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS tags_after_update_bump_lmod
AFTER UPDATE ON tags BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- entry_tags
CREATE TRIGGER IF NOT EXISTS entry_tags_after_insert_bump_lmod
AFTER INSERT ON entry_tags BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER IF NOT EXISTS entry_tags_after_update_bump_lmod
AFTER UPDATE ON entry_tags BEGIN
  INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- Soft-delete cascade: INSERT INTO deletes(table_name, id) sets the
-- corresponding row's `deleted` column to now. The row stays around as a
-- tombstone so other dictionaries' sync can pull the delete.
CREATE TRIGGER IF NOT EXISTS process_delete_cascade AFTER INSERT ON deletes
BEGIN
  UPDATE entries             SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'entries' AND deleted IS NULL;
  UPDATE senses              SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'senses' AND deleted IS NULL;
  UPDATE sentences           SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'sentences' AND deleted IS NULL;
  UPDATE senses_in_sentences SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'senses_in_sentences' AND deleted IS NULL;
  UPDATE speakers            SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'speakers' AND deleted IS NULL;
  UPDATE audio               SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'audio' AND deleted IS NULL;
  UPDATE audio_speakers      SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'audio_speakers' AND deleted IS NULL;
  UPDATE videos              SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'videos' AND deleted IS NULL;
  UPDATE video_speakers      SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'video_speakers' AND deleted IS NULL;
  UPDATE sense_videos        SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'sense_videos' AND deleted IS NULL;
  UPDATE sentence_videos     SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'sentence_videos' AND deleted IS NULL;
  UPDATE photos              SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'photos' AND deleted IS NULL;
  UPDATE sense_photos        SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'sense_photos' AND deleted IS NULL;
  UPDATE sentence_photos     SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'sentence_photos' AND deleted IS NULL;
  UPDATE dialects            SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'dialects' AND deleted IS NULL;
  UPDATE entry_dialects      SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'entry_dialects' AND deleted IS NULL;
  UPDATE tags                SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'tags' AND deleted IS NULL;
  UPDATE entry_tags          SET deleted = NEW.updated_at, updated_at = NEW.updated_at WHERE id = NEW.id AND NEW.table_name = 'entry_tags' AND deleted IS NULL;
END;
