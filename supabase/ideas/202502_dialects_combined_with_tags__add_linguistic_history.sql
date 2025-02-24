CREATE TYPE tag_type_enum AS ENUM ('dialect', 'tag', 'foo');

ALTER TABLE tags
ALTER COLUMN name TYPE jsonb USING name::jsonb, -- MultiString (was text previously), TODO: migrate existing data
ADD COLUMN type tag_type_enum NOT NULL DEFAULT 'tag';

DROP TABLE dialects; -- TODO: requires migrating them to tags first
DROP TABLE entry_dialects;

ALTER TABLE entries
ADD COLUMN linguistic_history jsonb -- MultiString;

DROP FUNCTION entries_from_timestamp(timestamp with time zone, text) CASCADE; -- must drop and recreate if changing the shape of the function
CREATE FUNCTION entries_from_timestamp(
  get_newer_than timestamp with time zone,
  dict_id text
) RETURNS TABLE(
  id text,
  dictionary_id text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  deleted timestamp with time zone,
  main jsonb,
  senses jsonb,
  audios jsonb,
  tag_ids jsonb
) AS $$
  WITH aggregated_audio AS (
    SELECT
      audio.entry_id,
      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', audio.id,
            'storage_path', audio.storage_path,
            'source', audio.source,
            'speaker_ids', audio_speakers.speaker_ids
          )
        )
      ORDER BY audio.created_at) AS audios
    FROM audio
    LEFT JOIN (
      SELECT
        audio_id,
        jsonb_agg(speaker_id) AS speaker_ids
      FROM audio_speakers
      WHERE deleted IS NULL
      GROUP BY audio_id
    ) AS audio_speakers ON audio_speakers.audio_id = audio.id
    WHERE audio.deleted IS NULL
    GROUP BY audio.entry_id
  )
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
        'linguistic_history', entries.linguistic_history, -- TODO: `pnpm generate-types`, then update augments.types.ts to handle new Jsonb fields in generated.types.ts, then run `pnpm generate-types` again
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
    aggregated_audio.audios,
    tag_ids.tag_ids
  FROM entries
  LEFT JOIN senses ON senses.entry_id = entries.id AND senses.deleted IS NULL
  LEFT JOIN aggregated_audio ON aggregated_audio.entry_id = entries.id
  LEFT JOIN (
    SELECT
      entry_id,
      jsonb_agg(tag_id) AS tag_ids
    FROM entry_tags
    WHERE deleted IS NULL
    GROUP BY entry_id
  ) AS tag_ids ON tag_ids.entry_id = entries.id
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
  WHERE entries.updated_at > get_newer_than AND (dict_id = '' OR entries.dictionary_id = dict_id)
  GROUP BY entries.id, aggregated_audio.audios, tag_ids.tag_ids
  ORDER BY entries.updated_at ASC;
$$ LANGUAGE SQL SECURITY DEFINER;

-- TODO: see if we need to renew the views or if they're good to go
-- CREATE MATERIALIZED VIEW materialized_entries_view AS
-- SELECT * FROM entries_from_timestamp('1970-01-01 01:00:00+00', ''); 

-- CREATE UNIQUE INDEX idx_materialized_entries_view_id ON materialized_entries_view (id);
-- REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_entries_view;

-- CREATE INDEX idx_materialized_entries_view_updated_at_dictionary_id 
-- ON materialized_entries_view (updated_at, dictionary_id);

-- DROP VIEW IF EXISTS entries_view;
-- CREATE VIEW entries_view AS
-- SELECT * FROM entries_from_timestamp('1970-01-01 01:00:00+00', ''); 