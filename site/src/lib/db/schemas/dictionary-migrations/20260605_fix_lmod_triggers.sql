-- Fix the last_modified_at bump triggers.
--
-- The 20260525 triggers used `INSERT OR REPLACE INTO db_metadata`, which throws
-- `UNIQUE constraint failed: db_metadata.key` when the trigger fires from an
-- UPSERT (`INSERT ... ON CONFLICT(id) DO UPDATE`) — the outer upsert's conflict
-- handling clashes with the trigger's OR REPLACE under defer_foreign_keys. The
-- sync engine's merge_dict_row (server) + #upsert_row (client pulls) both upsert,
-- so every editor push/pull to an existing row hit this. Recreate every bump
-- trigger with an explicit `ON CONFLICT(key) DO UPDATE`, which composes cleanly
-- with an outer upsert. (Plain UPDATEs were unaffected; the bug only surfaced via
-- the upsert path that the write/sync engine introduced.)

DROP TRIGGER IF EXISTS entries_after_insert_bump_lmod;
CREATE TRIGGER entries_after_insert_bump_lmod
AFTER INSERT ON entries BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS entries_after_update_bump_lmod;
CREATE TRIGGER entries_after_update_bump_lmod
AFTER UPDATE ON entries BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS texts_after_insert_bump_lmod;
CREATE TRIGGER texts_after_insert_bump_lmod
AFTER INSERT ON texts BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS texts_after_update_bump_lmod;
CREATE TRIGGER texts_after_update_bump_lmod
AFTER UPDATE ON texts BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS senses_after_insert_bump_lmod;
CREATE TRIGGER senses_after_insert_bump_lmod
AFTER INSERT ON senses BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS senses_after_update_bump_lmod;
CREATE TRIGGER senses_after_update_bump_lmod
AFTER UPDATE ON senses BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS sentences_after_insert_bump_lmod;
CREATE TRIGGER sentences_after_insert_bump_lmod
AFTER INSERT ON sentences BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS sentences_after_update_bump_lmod;
CREATE TRIGGER sentences_after_update_bump_lmod
AFTER UPDATE ON sentences BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS senses_in_sentences_after_insert_bump_lmod;
CREATE TRIGGER senses_in_sentences_after_insert_bump_lmod
AFTER INSERT ON senses_in_sentences BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS senses_in_sentences_after_update_bump_lmod;
CREATE TRIGGER senses_in_sentences_after_update_bump_lmod
AFTER UPDATE ON senses_in_sentences BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS speakers_after_insert_bump_lmod;
CREATE TRIGGER speakers_after_insert_bump_lmod
AFTER INSERT ON speakers BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS speakers_after_update_bump_lmod;
CREATE TRIGGER speakers_after_update_bump_lmod
AFTER UPDATE ON speakers BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS audio_after_insert_bump_lmod;
CREATE TRIGGER audio_after_insert_bump_lmod
AFTER INSERT ON audio BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS audio_after_update_bump_lmod;
CREATE TRIGGER audio_after_update_bump_lmod
AFTER UPDATE ON audio BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS audio_speakers_after_insert_bump_lmod;
CREATE TRIGGER audio_speakers_after_insert_bump_lmod
AFTER INSERT ON audio_speakers BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS audio_speakers_after_update_bump_lmod;
CREATE TRIGGER audio_speakers_after_update_bump_lmod
AFTER UPDATE ON audio_speakers BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS videos_after_insert_bump_lmod;
CREATE TRIGGER videos_after_insert_bump_lmod
AFTER INSERT ON videos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS videos_after_update_bump_lmod;
CREATE TRIGGER videos_after_update_bump_lmod
AFTER UPDATE ON videos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS video_speakers_after_insert_bump_lmod;
CREATE TRIGGER video_speakers_after_insert_bump_lmod
AFTER INSERT ON video_speakers BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS video_speakers_after_update_bump_lmod;
CREATE TRIGGER video_speakers_after_update_bump_lmod
AFTER UPDATE ON video_speakers BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS sense_videos_after_insert_bump_lmod;
CREATE TRIGGER sense_videos_after_insert_bump_lmod
AFTER INSERT ON sense_videos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS sense_videos_after_update_bump_lmod;
CREATE TRIGGER sense_videos_after_update_bump_lmod
AFTER UPDATE ON sense_videos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS sentence_videos_after_insert_bump_lmod;
CREATE TRIGGER sentence_videos_after_insert_bump_lmod
AFTER INSERT ON sentence_videos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS sentence_videos_after_update_bump_lmod;
CREATE TRIGGER sentence_videos_after_update_bump_lmod
AFTER UPDATE ON sentence_videos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS photos_after_insert_bump_lmod;
CREATE TRIGGER photos_after_insert_bump_lmod
AFTER INSERT ON photos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS photos_after_update_bump_lmod;
CREATE TRIGGER photos_after_update_bump_lmod
AFTER UPDATE ON photos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS sense_photos_after_insert_bump_lmod;
CREATE TRIGGER sense_photos_after_insert_bump_lmod
AFTER INSERT ON sense_photos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS sense_photos_after_update_bump_lmod;
CREATE TRIGGER sense_photos_after_update_bump_lmod
AFTER UPDATE ON sense_photos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS sentence_photos_after_insert_bump_lmod;
CREATE TRIGGER sentence_photos_after_insert_bump_lmod
AFTER INSERT ON sentence_photos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS sentence_photos_after_update_bump_lmod;
CREATE TRIGGER sentence_photos_after_update_bump_lmod
AFTER UPDATE ON sentence_photos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS dialects_after_insert_bump_lmod;
CREATE TRIGGER dialects_after_insert_bump_lmod
AFTER INSERT ON dialects BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS dialects_after_update_bump_lmod;
CREATE TRIGGER dialects_after_update_bump_lmod
AFTER UPDATE ON dialects BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS entry_dialects_after_insert_bump_lmod;
CREATE TRIGGER entry_dialects_after_insert_bump_lmod
AFTER INSERT ON entry_dialects BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS entry_dialects_after_update_bump_lmod;
CREATE TRIGGER entry_dialects_after_update_bump_lmod
AFTER UPDATE ON entry_dialects BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS tags_after_insert_bump_lmod;
CREATE TRIGGER tags_after_insert_bump_lmod
AFTER INSERT ON tags BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS tags_after_update_bump_lmod;
CREATE TRIGGER tags_after_update_bump_lmod
AFTER UPDATE ON tags BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS entry_tags_after_insert_bump_lmod;
CREATE TRIGGER entry_tags_after_insert_bump_lmod
AFTER INSERT ON entry_tags BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

DROP TRIGGER IF EXISTS entry_tags_after_update_bump_lmod;
CREATE TRIGGER entry_tags_after_update_bump_lmod
AFTER UPDATE ON entry_tags BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
