-- ALTER TABLE entries
-- DROP COLUMN plural_form,
-- DROP COLUMN variant;

ALTER TABLE senses
ADD COLUMN plural_form jsonb, -- MultiString
ADD COLUMN variant jsonb; -- MultiString

-- ALTER TABLE entries
-- DROP COLUMN dialects;

CREATE TABLE dialects (
  id uuid unique primary key NOT NULL,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  name jsonb NOT NULL, -- MultiString
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE dialects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dialects"
ON dialects 
FOR SELECT USING (true);

CREATE TABLE entry_dialects (
  entry_id text NOT NULL REFERENCES entries ON DELETE CASCADE,
  dialect_id uuid NOT NULL REFERENCES dialects ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted timestamp with time zone,
  PRIMARY KEY (entry_id, dialect_id)
);

ALTER TABLE entry_dialects ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_created_by_trigger_dialects
BEFORE UPDATE ON dialects
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

ALTER TABLE content_updates
ALTER COLUMN "table" DROP NOT NULL,
ADD COLUMN dialect_id uuid REFERENCES dialects;

------------------

ALTER TABLE entries
ALTER COLUMN notes TYPE jsonb USING notes::jsonb, -- MultiString (was text previously)
ADD COLUMN unsupported_fields jsonb, -- to place fields from imports like FLEx that don't fit into the current fields
ADD COLUMN elicitation_id text; -- Elicitation Id for Munda languages or Swadesh Composite number list from Comparalex, used for Onondaga custom sort

ALTER TABLE photos
ADD COLUMN dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE;

ALTER TABLE audio
ADD COLUMN dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
ADD COLUMN entry_id text REFERENCES entries,
ADD COLUMN sentence_id uuid REFERENCES sentences,
ADD COLUMN text_id uuid REFERENCES texts;

ALTER TABLE videos
ALTER COLUMN storage_path DROP NOT NULL,
ADD COLUMN dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
ADD COLUMN hosted_elsewhere jsonb, -- Hosted elsewhere (e.g. YouTube, Vimeo, etc.)
ADD COLUMN text_id uuid REFERENCES texts;

ALTER TABLE senses
ADD CONSTRAINT foreign_key_entries
FOREIGN KEY (entry_id) REFERENCES entries(id);

ALTER TABLE speakers
ADD COLUMN dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE;

CREATE OR REPLACE VIEW speakers_view AS
SELECT
  id,
  dictionary_id,
  name,
  decade,
  gender,
  birthplace,
  created_at,
  updated_at,
  deleted
FROM speakers;

CREATE POLICY "Anyone can view sentences"
ON sentences 
FOR SELECT USING (true);

CREATE POLICY "Anyone can view photos"
ON photos 
FOR SELECT USING (true);

CREATE OR REPLACE VIEW videos_view AS
SELECT
  videos.id AS id,
  videos.dictionary_id AS dictionary_id,
  videos.storage_path AS storage_path,
  videos.source AS source,
  videos.videographer AS videographer,
  videos.hosted_elsewhere AS hosted_elsewhere,
  videos.text_id AS text_id,
  video_speakers.speaker_ids AS speaker_ids,
  videos.created_at AS created_at,
  videos.updated_at AS updated_at,
  videos.deleted AS deleted
FROM videos
LEFT JOIN (
  SELECT
    video_id,
    jsonb_agg(speaker_id) AS speaker_ids
  FROM video_speakers
  WHERE deleted IS NULL
  GROUP BY video_id
) AS video_speakers ON video_speakers.video_id = videos.id;

DROP VIEW IF EXISTS entries_view;

CREATE OR REPLACE VIEW entries_view AS
SELECT
  entries.id AS id,
  entries.dictionary_id AS dictionary_id,
  entries.created_at,
  entries.updated_at,
  entries.deleted,
  jsonb_strip_nulls(
    jsonb_build_object(
      'lexeme', entries.lexeme,
      'phonetic', entries.phonetic,
      'interlinearization', entries.interlinearization,
      'morphology', entries.morphology,
      'notes', entries.notes,
      'sources', entries.sources,
      'scientific_names', entries.scientific_names,
      'coordinates', entries.coordinates,
      'unsupported_fields', entries.unsupported_fields,
      'elicitation_id', entries.elicitation_id
    )
  ) AS main,
  CASE 
    WHEN COUNT(senses.id) > 0 THEN jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', senses.id,
          'glosses', senses.glosses,
          'parts_of_speech', senses.parts_of_speech,
          'semantic_domains', senses.semantic_domains,
          'write_in_semantic_domains', senses.write_in_semantic_domains,
          'noun_class', senses.noun_class,
          'definition', senses.definition,
          'plural_form', senses.plural_form,
          'variant', senses.variant,
          'sentence_ids', sentence_ids,
          'photo_ids', photo_ids,
          'video_ids', video_ids
        )
      )
      ORDER BY senses.created_at
    )
    ELSE NULL
  END AS senses,
  CASE 
    WHEN COUNT(audio.id) > 0 THEN jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', audio.id,
          'storage_path', audio.storage_path,
          'source', audio.source,
          'speaker_ids', audio_speakers.speaker_ids
        )
      )
      ORDER BY audio.created_at
    )
    ELSE NULL
  END AS audios,
  dialect_ids.dialect_ids
FROM entries
LEFT JOIN senses ON senses.entry_id = entries.id AND senses.deleted IS NULL
LEFT JOIN audio ON audio.entry_id = entries.id AND audio.deleted IS NULL
LEFT JOIN (
  SELECT
    audio_id,
    jsonb_agg(speaker_id) AS speaker_ids
  FROM audio_speakers
  WHERE deleted IS NULL
  GROUP BY audio_id
) AS audio_speakers ON audio_speakers.audio_id = audio.id
LEFT JOIN (
  SELECT
    entry_id,
    jsonb_agg(dialect_id) AS dialect_ids
  FROM entry_dialects
  WHERE deleted IS NULL
  GROUP BY entry_id
) AS dialect_ids ON dialect_ids.entry_id = entries.id
LEFT JOIN (
  SELECT
    senses_in_sentences.sense_id,
    jsonb_agg(senses_in_sentences.sentence_id) AS sentence_ids
  FROM senses_in_sentences
  JOIN sentences ON sentences.id = senses_in_sentences.sentence_id
  WHERE sentences.deleted IS NULL AND senses_in_sentences.deleted IS NULL
  GROUP BY senses_in_sentences.sense_id
) AS sense_sentences ON sense_sentences.sense_id = senses.id
LEFT JOIN (
  SELECT
    sense_photos.sense_id,
    jsonb_agg(sense_photos.photo_id) AS photo_ids
  FROM sense_photos
  JOIN photos ON photos.id = sense_photos.photo_id
  WHERE photos.deleted IS NULL AND sense_photos.deleted IS NULL
  GROUP BY sense_photos.sense_id
) AS aggregated_photo_ids ON aggregated_photo_ids.sense_id = senses.id
LEFT JOIN (
  SELECT
    sense_videos.sense_id,
    jsonb_agg(sense_videos.video_id) AS video_ids
  FROM sense_videos
  JOIN videos ON videos.id = sense_videos.video_id
  WHERE videos.deleted IS NULL AND sense_videos.deleted IS NULL
  GROUP BY sense_videos.sense_id
) AS aggregated_video_ids ON aggregated_video_ids.sense_id = senses.id
GROUP BY entries.id, dialect_ids.dialect_ids;

-- Entries loading plan:
-- When Jim loads entries for the first time on client, the client and NOT the view needs to check WHERE entries.deleted IS NULL. Then in the future if Bob deletes 1 entry, and Jim visits again, Jim will have 20 cached entries. He then loads fresh entries without the WHERE entries.deleted IS NULL when he comes today so that he gets Bob's deleted change. Then Jim's knows to remove that deleted entry from the cache

CREATE MATERIALIZED VIEW materialized_entries_view AS
SELECT * FROM entries_view; -- DROP MATERIALIZED VIEW materialized_entries_view;

CREATE UNIQUE INDEX idx_materialized_entries_view_id ON materialized_entries_view (id); -- When you refresh data for a materialized view, PostgreSQL locks the underlying tables. To avoid this, use the CONCURRENTLY option so that PostgreSQL creates a temporary updated version of the materialized view, compares two versions, and performs INSERT and UPDATE on only the differences. To use CONCURRENTLY the materialized view must have a UNIQUE index:

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

SELECT cron.schedule (
    'refresh-materialized_entries_view', -- Job name
    '0 * * * *', -- Every hour, you can re-run this SQL with a new time amount to change the frequency
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_entries_view $$
); -- SELECT cron.unschedule('refresh-materialized_entries_view');

CREATE OR REPLACE FUNCTION update_entry_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  entry_id_to_use text;
  new_updated_at timestamp with time zone;
BEGIN
  entry_id_to_use := COALESCE(NEW.entry_id, OLD.entry_id);
  
  BEGIN
    new_updated_at := NEW.updated_at;
  EXCEPTION
    WHEN others THEN
      new_updated_at := NULL;
  END;
  
  UPDATE entries
  SET updated_at = COALESCE(new_updated_at, NEW.created_at, NOW())
  WHERE id = entry_id_to_use;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_entry_updated_at_senses
AFTER INSERT OR UPDATE ON senses
FOR EACH ROW
EXECUTE FUNCTION update_entry_updated_at();

CREATE TRIGGER update_entry_updated_at_audio
AFTER INSERT OR UPDATE ON audio
FOR EACH ROW
EXECUTE FUNCTION update_entry_updated_at();

CREATE TRIGGER update_entry_updated_at_entry_dialects
AFTER INSERT OR UPDATE ON entry_dialects
FOR EACH ROW
EXECUTE FUNCTION update_entry_updated_at();

CREATE OR REPLACE FUNCTION update_sense_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE senses
  SET updated_at = COALESCE(NEW.deleted, NEW.created_at, NOW())
  WHERE id = NEW.sense_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sense_updated_at_senses_in_sentences
AFTER INSERT OR UPDATE ON senses_in_sentences
FOR EACH ROW
EXECUTE FUNCTION update_sense_updated_at();

CREATE TRIGGER update_sense_updated_at_sense_photos
AFTER INSERT OR UPDATE ON sense_photos
FOR EACH ROW
EXECUTE FUNCTION update_sense_updated_at();

CREATE TRIGGER update_sense_updated_at_sense_videos
AFTER INSERT OR UPDATE ON sense_videos
FOR EACH ROW
EXECUTE FUNCTION update_sense_updated_at();

CREATE OR REPLACE FUNCTION update_sense_sentences_when_sentence_deleted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted IS NOT NULL THEN
    UPDATE sense_sentences
    SET deleted = NEW.deleted
    WHERE sentence_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sense_updated_at_sense_sentences
AFTER UPDATE ON sentences
FOR EACH ROW
EXECUTE FUNCTION update_sense_sentences_when_sentence_deleted();

CREATE OR REPLACE FUNCTION update_sense_photos_when_photo_deleted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted IS NOT NULL THEN
    UPDATE sense_photos
    SET deleted = NEW.deleted
    WHERE photo_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sense_updated_at_sense_photos
AFTER UPDATE ON photos
FOR EACH ROW
EXECUTE FUNCTION update_sense_photos_when_photo_deleted();

CREATE OR REPLACE FUNCTION update_sense_videos_when_video_deleted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted IS NOT NULL THEN
    UPDATE sense_videos
    SET deleted = NEW.deleted
    WHERE video_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sense_updated_at_sense_videos
AFTER UPDATE ON videos
FOR EACH ROW
EXECUTE FUNCTION update_sense_videos_when_video_deleted();

-- TODO: test these and also test the OLD.created_at above when deleting relationships (shouldn't use OLD.created_at)

CREATE OR REPLACE FUNCTION update_audio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE audio
  SET updated_at = COALESCE(NEW.created_at, NOW())
  WHERE id = NEW.audio_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_audio_updated_at_audio_speakers
AFTER INSERT OR UPDATE ON audio_speakers
FOR EACH ROW
EXECUTE FUNCTION update_audio_updated_at();

------------------

DROP TRIGGER IF EXISTS on_entry_updates ON entry_updates;
DROP FUNCTION IF EXISTS apply_entry_updates();

DROP TRIGGER IF EXISTS convert_email_to_id_before_insert ON entry_updates;
DROP FUNCTION IF EXISTS convert_firebase_email_to_supabase_user_id();