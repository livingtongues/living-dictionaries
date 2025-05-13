DROP VIEW IF EXISTS speakers_view;
DROP VIEW IF EXISTS videos_view;

SELECT cron.unschedule('refresh-materialized_entries_view');
DROP FUNCTION entries_from_timestamp(timestamp with time zone, text) CASCADE;
DROP FUNCTION entry_by_id(text) CASCADE;
-- below is already dropped by above cascades
-- DROP VIEW IF EXISTS entries_view CASCADE; 
-- DROP MATERIALIZED VIEW IF EXISTS materialized_entries_view CASCADE;
-- DROP INDEX IF EXISTS idx_materialized_entries_view_id CASCADE;
-- DROP INDEX IF EXISTS idx_materialized_entries_view_updated_at_dictionary_id CASCADE;

DROP FUNCTION update_audio_updated_at() CASCADE;
DROP FUNCTION update_sense_updated_at() CASCADE;
DROP FUNCTION update_entry_updated_at() CASCADE;

--------

CREATE OR REPLACE FUNCTION update_dictionary_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  dictionary_id_to_use text;
  new_updated_at timestamp with time zone;
BEGIN
  dictionary_id_to_use := COALESCE(NEW.dictionary_id, OLD.dictionary_id);

  BEGIN
    new_updated_at := NEW.updated_at;
  EXCEPTION
    WHEN others THEN
      new_updated_at := NULL;
  END;
  
  UPDATE dictionaries
  SET updated_at = COALESCE(new_updated_at, NEW.deleted, NEW.created_at, NOW())
  WHERE id = dictionary_id_to_use;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dictionary_updated_at_entries
AFTER INSERT OR UPDATE ON entries
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_senses
AFTER INSERT OR UPDATE ON senses
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_audio
AFTER INSERT OR UPDATE ON audio
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_speakers
AFTER INSERT OR UPDATE ON speakers
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_tags
AFTER INSERT OR UPDATE ON tags
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_dialects
AFTER INSERT OR UPDATE ON dialects
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_photos
AFTER INSERT OR UPDATE ON photos
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_videos
AFTER INSERT OR UPDATE ON videos
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_sentences
AFTER INSERT OR UPDATE ON sentences
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_audio_speakers
AFTER INSERT OR UPDATE ON audio_speakers
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_entry_tags
AFTER INSERT OR UPDATE ON entry_tags
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_entry_dialects
AFTER INSERT OR UPDATE ON entry_dialects
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_sense_photos
AFTER INSERT OR UPDATE ON sense_photos
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_video_speakers
AFTER INSERT OR UPDATE ON video_speakers
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_sense_videos
AFTER INSERT OR UPDATE ON sense_videos
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_senses_in_sentences
AFTER INSERT OR UPDATE ON senses_in_sentences
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();