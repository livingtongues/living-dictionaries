-- subqueryies
CREATE OR REPLACE FUNCTION entries_from_timestamp(
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
  dialect_ids jsonb
) AS $$
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
    (
      SELECT jsonb_agg(
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
      ORDER BY senses.created_at)
      FROM senses
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
      WHERE senses.entry_id = entries.id AND senses.deleted IS NULL
    ) AS senses,
    (
      SELECT jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', audio.id,
            'storage_path', audio.storage_path,
            'source', audio.source,
            'speaker_ids', audio_speakers.speaker_ids
          )
        )
      ORDER BY audio.created_at)
      FROM audio
      LEFT JOIN (
        SELECT
          audio_id,
          jsonb_agg(speaker_id) AS speaker_ids
        FROM audio_speakers
        WHERE deleted IS NULL
        GROUP BY audio_id
      ) AS audio_speakers ON audio_speakers.audio_id = audio.id
      WHERE audio.entry_id = entries.id AND audio.deleted IS NULL
    ) AS audios,
    (
      SELECT jsonb_agg(dialect_id)
      FROM entry_dialects
      WHERE entry_id = entries.id AND deleted IS NULL
    ) AS dialect_ids
  FROM entries
  WHERE entries.updated_at > get_newer_than AND (dict_id = '' OR entries.dictionary_id = dict_id)
  ORDER BY entries.updated_at ASC;
$$ LANGUAGE SQL SECURITY DEFINER;

-- CTE
CREATE OR REPLACE FUNCTION entries_from_timestamp(
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
  dialect_ids jsonb
) AS $$
  WITH recent_entries AS (
    SELECT
      entries.id,
      entries.dictionary_id,
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
      ) AS main
    FROM entries
    WHERE entries.updated_at > get_newer_than AND (dict_id = '' OR entries.dictionary_id = dict_id)
    ORDER BY entries.updated_at ASC
  ),
  senses_data AS (
    SELECT
      senses.entry_id,
      jsonb_agg(
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
      ORDER BY senses.created_at) AS senses
    FROM senses
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
    WHERE senses.deleted IS NULL
    GROUP BY senses.entry_id
  ),
  audio_data AS (
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
  ),
  dialect_data AS (
    SELECT
      entry_id,
      jsonb_agg(dialect_id) AS dialect_ids
    FROM entry_dialects
    WHERE deleted IS NULL
    GROUP BY entry_id
  )
  SELECT
    recent_entries.id,
    recent_entries.dictionary_id,
    recent_entries.created_at,
    recent_entries.updated_at,
    recent_entries.deleted,
    recent_entries.main,
    senses_data.senses,
    audio_data.audios,
    dialect_data.dialect_ids
  FROM recent_entries
  LEFT JOIN senses_data ON senses_data.entry_id = recent_entries.id
  LEFT JOIN audio_data ON audio_data.entry_id = recent_entries.id
  LEFT JOIN dialect_data ON dialect_data.entry_id = recent_entries.id;
$$ LANGUAGE SQL SECURITY DEFINER;