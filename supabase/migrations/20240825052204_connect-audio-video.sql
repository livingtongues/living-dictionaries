ALTER TABLE audio
ADD COLUMN entry_id text REFERENCES entries,
ADD COLUMN sentence_id uuid REFERENCES sentences,
ADD COLUMN text_id uuid REFERENCES texts;

ALTER TABLE videos
ALTER COLUMN storage_path DROP NOT NULL,
ADD COLUMN hosted_elsewhere jsonb, -- Hosted elsewhere (e.g. YouTube, Vimeo, etc.)
ADD COLUMN text_id uuid REFERENCES texts;

ALTER TABLE senses
ADD CONSTRAINT foreign_key_entries
FOREIGN KEY (entry_id) REFERENCES entries(id);

DROP VIEW IF EXISTS entries_view;

CREATE OR REPLACE VIEW entries_view AS
SELECT
  entries.id AS id,
  entries.dictionary_id AS dictionary_id,
  jsonb_strip_nulls(
    jsonb_build_object(
      'id', entries.id,
      'lexeme', entries.lexeme,
      'phonetic', entries.phonetic,
      'interlinearization', entries.interlinearization,
      'morphology', entries.morphology,
      'notes', entries.notes,
      'sources', entries.sources,
      'scientific_names', entries.scientific_names,
      'coordinates', entries.coordinates,
      'unsupported_fields', entries.unsupported_fields,
      'elicitation_id', entries.elicitation_id,
      'created_at', entries.created_at,
      'updated_at', entries.updated_at
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
          'sentences', aggregated_sentences.sentences,
          'photos', aggregated_photos.photos,
          'videos', aggregated_videos.videos
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
          'source', audio.source
          -- 'speakers', aggregated_speakers.speakers // we will do this client-side for now
        )
      )
      ORDER BY audio.created_at
    )
    ELSE NULL
  END AS audios,
  CASE
    WHEN COUNT(entry_dialects.dialect_id) > 0 THEN jsonb_agg(entry_dialects.dialect_id)
    ELSE NULL
  END AS dialect_ids
FROM entries
LEFT JOIN senses ON senses.entry_id = entries.id AND senses.deleted IS NULL
LEFT JOIN audio ON audio.entry_id = entries.id AND audio.deleted IS NULL
LEFT JOIN entry_dialects ON entry_dialects.entry_id = entries.id AND entry_dialects.deleted IS NULL
LEFT JOIN (
  SELECT
    senses_in_sentences.sense_id,
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', sentences.id,
          'text', sentences.text,
          'translation', sentences.translation
        )
      )
    ) AS sentences
  FROM senses_in_sentences
  JOIN sentences ON sentences.id = senses_in_sentences.sentence_id
  WHERE sentences.deleted IS NULL AND senses_in_sentences.deleted IS NULL
  GROUP BY senses_in_sentences.sense_id
) AS aggregated_sentences ON aggregated_sentences.sense_id = senses.id
LEFT JOIN (
  SELECT
    sense_photos.sense_id,
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', photos.id,
          'serving_url', photos.serving_url,
          'source', photos.source,
          'photographer', photos.photographer
        )
      )
    ) AS photos
  FROM sense_photos
  JOIN photos ON photos.id = sense_photos.photo_id
  WHERE photos.deleted IS NULL AND sense_photos.deleted IS NULL
  GROUP BY sense_photos.sense_id
) AS aggregated_photos ON aggregated_photos.sense_id = senses.id
LEFT JOIN (
  SELECT
    sense_videos.sense_id,
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', videos.id,
          'storage_path', videos.storage_path,
          'source', videos.source,
          'videographer', videos.videographer,
          'hosted_elsewhere', videos.hosted_elsewhere
        )
      )
    ) AS videos
  FROM sense_videos
  JOIN videos ON videos.id = sense_videos.video_id
  WHERE videos.deleted IS NULL AND sense_videos.deleted IS NULL
  GROUP BY sense_videos.sense_id
) AS aggregated_videos ON aggregated_videos.sense_id = senses.id
WHERE entries.deleted IS NULL
GROUP BY entries.id;
