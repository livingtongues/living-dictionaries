-- server_seq: server-assigned monotonic sync cursor (root fix for the FK-wedge
-- sync hole — see .issues/sync-fk-wedge-server-seq-and-self-heal.md).
--
-- WHY: pulls used to filter `WHERE updated_at > cursor`, but merged rows keep the
-- CLIENT-supplied updated_at (the LWW arbiter). A row pushed with a stamp older
-- than another client's cursor was invisible to that client FOREVER; when a child
-- of that row later rode down, the client's deferred-FK check failed at COMMIT and
-- every subsequent sync rolled back (permanent wedge). `server_seq` is assigned by
-- triggers from a strictly monotonic per-DB counter on EVERY insert/update — pulls
-- filter on it instead, so nothing can land below a client's watermark.
--
-- These triggers run on the server AND on every client DB (same migration files).
-- Client-side assignments are meaningless-but-harmless: the server strips
-- `server_seq` from pushed rows and reassigns via its own triggers, and clients
-- track their cursor from the response (`db_metadata.synced_seq`), never from
-- their local counter.
--
-- VERIFIED (see server-seq test): FK actions (ON DELETE CASCADE / SET NULL) fire
-- these triggers regardless of recursive_triggers, so cascade-touched rows get a
-- fresh seq and ride the next pull. recursive_triggers is OFF (default) in
-- better-sqlite3 + wa-sqlite, so the self-UPDATE inside each trigger cannot
-- recurse; the WHEN guard on the update trigger is belt-and-braces.

CREATE TABLE IF NOT EXISTS server_seq_counter (
  seq INTEGER NOT NULL
);
INSERT INTO server_seq_counter (seq)
  SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM server_seq_counter);


------------------------------------------------------------------
-- entries
------------------------------------------------------------------
ALTER TABLE entries ADD COLUMN server_seq INTEGER;
UPDATE entries SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_entries_server_seq ON entries(server_seq);

DROP TRIGGER IF EXISTS entries_server_seq_ai;
CREATE TRIGGER entries_server_seq_ai AFTER INSERT ON entries
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE entries SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS entries_server_seq_au;
CREATE TRIGGER entries_server_seq_au AFTER UPDATE ON entries
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE entries SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- texts
------------------------------------------------------------------
ALTER TABLE texts ADD COLUMN server_seq INTEGER;
UPDATE texts SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_texts_server_seq ON texts(server_seq);

DROP TRIGGER IF EXISTS texts_server_seq_ai;
CREATE TRIGGER texts_server_seq_ai AFTER INSERT ON texts
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE texts SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS texts_server_seq_au;
CREATE TRIGGER texts_server_seq_au AFTER UPDATE ON texts
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE texts SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- sentences
------------------------------------------------------------------
ALTER TABLE sentences ADD COLUMN server_seq INTEGER;
UPDATE sentences SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_sentences_server_seq ON sentences(server_seq);

DROP TRIGGER IF EXISTS sentences_server_seq_ai;
CREATE TRIGGER sentences_server_seq_ai AFTER INSERT ON sentences
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE sentences SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS sentences_server_seq_au;
CREATE TRIGGER sentences_server_seq_au AFTER UPDATE ON sentences
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE sentences SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- senses
------------------------------------------------------------------
ALTER TABLE senses ADD COLUMN server_seq INTEGER;
UPDATE senses SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_senses_server_seq ON senses(server_seq);

DROP TRIGGER IF EXISTS senses_server_seq_ai;
CREATE TRIGGER senses_server_seq_ai AFTER INSERT ON senses
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE senses SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS senses_server_seq_au;
CREATE TRIGGER senses_server_seq_au AFTER UPDATE ON senses
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE senses SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- senses_in_sentences
------------------------------------------------------------------
ALTER TABLE senses_in_sentences ADD COLUMN server_seq INTEGER;
UPDATE senses_in_sentences SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_senses_in_sentences_server_seq ON senses_in_sentences(server_seq);

DROP TRIGGER IF EXISTS senses_in_sentences_server_seq_ai;
CREATE TRIGGER senses_in_sentences_server_seq_ai AFTER INSERT ON senses_in_sentences
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE senses_in_sentences SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS senses_in_sentences_server_seq_au;
CREATE TRIGGER senses_in_sentences_server_seq_au AFTER UPDATE ON senses_in_sentences
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE senses_in_sentences SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- speakers
------------------------------------------------------------------
ALTER TABLE speakers ADD COLUMN server_seq INTEGER;
UPDATE speakers SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_speakers_server_seq ON speakers(server_seq);

DROP TRIGGER IF EXISTS speakers_server_seq_ai;
CREATE TRIGGER speakers_server_seq_ai AFTER INSERT ON speakers
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE speakers SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS speakers_server_seq_au;
CREATE TRIGGER speakers_server_seq_au AFTER UPDATE ON speakers
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE speakers SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- audio
------------------------------------------------------------------
ALTER TABLE audio ADD COLUMN server_seq INTEGER;
UPDATE audio SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_audio_server_seq ON audio(server_seq);

DROP TRIGGER IF EXISTS audio_server_seq_ai;
CREATE TRIGGER audio_server_seq_ai AFTER INSERT ON audio
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE audio SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS audio_server_seq_au;
CREATE TRIGGER audio_server_seq_au AFTER UPDATE ON audio
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE audio SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- audio_speakers
------------------------------------------------------------------
ALTER TABLE audio_speakers ADD COLUMN server_seq INTEGER;
UPDATE audio_speakers SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_audio_speakers_server_seq ON audio_speakers(server_seq);

DROP TRIGGER IF EXISTS audio_speakers_server_seq_ai;
CREATE TRIGGER audio_speakers_server_seq_ai AFTER INSERT ON audio_speakers
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE audio_speakers SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS audio_speakers_server_seq_au;
CREATE TRIGGER audio_speakers_server_seq_au AFTER UPDATE ON audio_speakers
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE audio_speakers SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- videos
------------------------------------------------------------------
ALTER TABLE videos ADD COLUMN server_seq INTEGER;
UPDATE videos SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_videos_server_seq ON videos(server_seq);

DROP TRIGGER IF EXISTS videos_server_seq_ai;
CREATE TRIGGER videos_server_seq_ai AFTER INSERT ON videos
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE videos SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS videos_server_seq_au;
CREATE TRIGGER videos_server_seq_au AFTER UPDATE ON videos
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE videos SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- video_speakers
------------------------------------------------------------------
ALTER TABLE video_speakers ADD COLUMN server_seq INTEGER;
UPDATE video_speakers SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_video_speakers_server_seq ON video_speakers(server_seq);

DROP TRIGGER IF EXISTS video_speakers_server_seq_ai;
CREATE TRIGGER video_speakers_server_seq_ai AFTER INSERT ON video_speakers
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE video_speakers SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS video_speakers_server_seq_au;
CREATE TRIGGER video_speakers_server_seq_au AFTER UPDATE ON video_speakers
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE video_speakers SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- sense_videos
------------------------------------------------------------------
ALTER TABLE sense_videos ADD COLUMN server_seq INTEGER;
UPDATE sense_videos SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_sense_videos_server_seq ON sense_videos(server_seq);

DROP TRIGGER IF EXISTS sense_videos_server_seq_ai;
CREATE TRIGGER sense_videos_server_seq_ai AFTER INSERT ON sense_videos
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE sense_videos SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS sense_videos_server_seq_au;
CREATE TRIGGER sense_videos_server_seq_au AFTER UPDATE ON sense_videos
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE sense_videos SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- sentence_videos
------------------------------------------------------------------
ALTER TABLE sentence_videos ADD COLUMN server_seq INTEGER;
UPDATE sentence_videos SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_sentence_videos_server_seq ON sentence_videos(server_seq);

DROP TRIGGER IF EXISTS sentence_videos_server_seq_ai;
CREATE TRIGGER sentence_videos_server_seq_ai AFTER INSERT ON sentence_videos
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE sentence_videos SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS sentence_videos_server_seq_au;
CREATE TRIGGER sentence_videos_server_seq_au AFTER UPDATE ON sentence_videos
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE sentence_videos SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- photos
------------------------------------------------------------------
ALTER TABLE photos ADD COLUMN server_seq INTEGER;
UPDATE photos SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_photos_server_seq ON photos(server_seq);

DROP TRIGGER IF EXISTS photos_server_seq_ai;
CREATE TRIGGER photos_server_seq_ai AFTER INSERT ON photos
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE photos SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS photos_server_seq_au;
CREATE TRIGGER photos_server_seq_au AFTER UPDATE ON photos
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE photos SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- sense_photos
------------------------------------------------------------------
ALTER TABLE sense_photos ADD COLUMN server_seq INTEGER;
UPDATE sense_photos SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_sense_photos_server_seq ON sense_photos(server_seq);

DROP TRIGGER IF EXISTS sense_photos_server_seq_ai;
CREATE TRIGGER sense_photos_server_seq_ai AFTER INSERT ON sense_photos
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE sense_photos SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS sense_photos_server_seq_au;
CREATE TRIGGER sense_photos_server_seq_au AFTER UPDATE ON sense_photos
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE sense_photos SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- sentence_photos
------------------------------------------------------------------
ALTER TABLE sentence_photos ADD COLUMN server_seq INTEGER;
UPDATE sentence_photos SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_sentence_photos_server_seq ON sentence_photos(server_seq);

DROP TRIGGER IF EXISTS sentence_photos_server_seq_ai;
CREATE TRIGGER sentence_photos_server_seq_ai AFTER INSERT ON sentence_photos
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE sentence_photos SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS sentence_photos_server_seq_au;
CREATE TRIGGER sentence_photos_server_seq_au AFTER UPDATE ON sentence_photos
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE sentence_photos SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- dialects
------------------------------------------------------------------
ALTER TABLE dialects ADD COLUMN server_seq INTEGER;
UPDATE dialects SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_dialects_server_seq ON dialects(server_seq);

DROP TRIGGER IF EXISTS dialects_server_seq_ai;
CREATE TRIGGER dialects_server_seq_ai AFTER INSERT ON dialects
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE dialects SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS dialects_server_seq_au;
CREATE TRIGGER dialects_server_seq_au AFTER UPDATE ON dialects
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE dialects SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- entry_dialects
------------------------------------------------------------------
ALTER TABLE entry_dialects ADD COLUMN server_seq INTEGER;
UPDATE entry_dialects SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_entry_dialects_server_seq ON entry_dialects(server_seq);

DROP TRIGGER IF EXISTS entry_dialects_server_seq_ai;
CREATE TRIGGER entry_dialects_server_seq_ai AFTER INSERT ON entry_dialects
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE entry_dialects SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS entry_dialects_server_seq_au;
CREATE TRIGGER entry_dialects_server_seq_au AFTER UPDATE ON entry_dialects
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE entry_dialects SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- tags
------------------------------------------------------------------
ALTER TABLE tags ADD COLUMN server_seq INTEGER;
UPDATE tags SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_tags_server_seq ON tags(server_seq);

DROP TRIGGER IF EXISTS tags_server_seq_ai;
CREATE TRIGGER tags_server_seq_ai AFTER INSERT ON tags
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE tags SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS tags_server_seq_au;
CREATE TRIGGER tags_server_seq_au AFTER UPDATE ON tags
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE tags SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- entry_tags
------------------------------------------------------------------
ALTER TABLE entry_tags ADD COLUMN server_seq INTEGER;
UPDATE entry_tags SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_entry_tags_server_seq ON entry_tags(server_seq);

DROP TRIGGER IF EXISTS entry_tags_server_seq_ai;
CREATE TRIGGER entry_tags_server_seq_ai AFTER INSERT ON entry_tags
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE entry_tags SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS entry_tags_server_seq_au;
CREATE TRIGGER entry_tags_server_seq_au AFTER UPDATE ON entry_tags
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE entry_tags SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- sources
------------------------------------------------------------------
ALTER TABLE sources ADD COLUMN server_seq INTEGER;
UPDATE sources SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_sources_server_seq ON sources(server_seq);

DROP TRIGGER IF EXISTS sources_server_seq_ai;
CREATE TRIGGER sources_server_seq_ai AFTER INSERT ON sources
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE sources SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS sources_server_seq_au;
CREATE TRIGGER sources_server_seq_au AFTER UPDATE ON sources
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE sources SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- relationship_types
------------------------------------------------------------------
ALTER TABLE relationship_types ADD COLUMN server_seq INTEGER;
UPDATE relationship_types SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_relationship_types_server_seq ON relationship_types(server_seq);

DROP TRIGGER IF EXISTS relationship_types_server_seq_ai;
CREATE TRIGGER relationship_types_server_seq_ai AFTER INSERT ON relationship_types
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE relationship_types SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS relationship_types_server_seq_au;
CREATE TRIGGER relationship_types_server_seq_au AFTER UPDATE ON relationship_types
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE relationship_types SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- entry_relationships
------------------------------------------------------------------
ALTER TABLE entry_relationships ADD COLUMN server_seq INTEGER;
UPDATE entry_relationships SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_entry_relationships_server_seq ON entry_relationships(server_seq);

DROP TRIGGER IF EXISTS entry_relationships_server_seq_ai;
CREATE TRIGGER entry_relationships_server_seq_ai AFTER INSERT ON entry_relationships
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE entry_relationships SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS entry_relationships_server_seq_au;
CREATE TRIGGER entry_relationships_server_seq_au AFTER UPDATE ON entry_relationships
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE entry_relationships SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- featured_entries
------------------------------------------------------------------
ALTER TABLE featured_entries ADD COLUMN server_seq INTEGER;
UPDATE featured_entries SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_featured_entries_server_seq ON featured_entries(server_seq);

DROP TRIGGER IF EXISTS featured_entries_server_seq_ai;
CREATE TRIGGER featured_entries_server_seq_ai AFTER INSERT ON featured_entries
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE featured_entries SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS featured_entries_server_seq_au;
CREATE TRIGGER featured_entries_server_seq_au AFTER UPDATE ON featured_entries
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE featured_entries SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- deletes (tombstones need a seq too — the tombstone pull rides the same cursor)
------------------------------------------------------------------
ALTER TABLE deletes ADD COLUMN server_seq INTEGER;
UPDATE deletes SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_deletes_server_seq ON deletes(server_seq);

DROP TRIGGER IF EXISTS deletes_server_seq_ai;
CREATE TRIGGER deletes_server_seq_ai AFTER INSERT ON deletes
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE deletes SET server_seq = (SELECT seq FROM server_seq_counter)
    WHERE table_name = NEW.table_name AND id = NEW.id;
END;

-- Initialize the counter above every backfilled seq so fresh assignments are
-- strictly greater than anything pre-existing.
UPDATE server_seq_counter SET seq = (
  SELECT MAX(m) FROM (
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM entries UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM texts UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM sentences UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM senses UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM senses_in_sentences UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM speakers UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM audio UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM audio_speakers UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM videos UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM video_speakers UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM sense_videos UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM sentence_videos UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM photos UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM sense_photos UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM sentence_photos UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM dialects UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM entry_dialects UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM tags UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM entry_tags UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM sources UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM relationship_types UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM entry_relationships UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM featured_entries UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM deletes
  )
);