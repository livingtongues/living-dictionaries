CREATE TABLE dictionaries (
  id text unique primary key NOT NULL
);

CREATE TABLE entries (
  id text unique primary key NOT NULL,
  dictionary_id text NOT NULL REFERENCES dictionaries,
  lexeme jsonb NOT NULL,
  phonetic text,
  interlinearization text,
  morphology text,
  notes jsonb,
  sources text[],
  scientific_names text[],
  coordinates jsonb,
  unsupported_fields jsonb,
  elicitation_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted timestamp with time zone
);

CREATE TABLE senses (
  id uuid unique primary key NOT NULL,
  entry_id text NOT NULL REFERENCES entries,
  "definition" jsonb,
  glosses jsonb,
  parts_of_speech text[],
  semantic_domains text[],
  write_in_semantic_domains text[],
  noun_class character varying,
  plural_form jsonb,
  variant jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted timestamp with time zone
);

CREATE TABLE sentences (
  id uuid unique primary key NOT NULL,
  dictionary_id text NOT NULL REFERENCES dictionaries,
  "text" jsonb,
  translation jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted timestamp with time zone
);

CREATE TABLE senses_in_sentences (
  sense_id uuid NOT NULL REFERENCES senses ON DELETE CASCADE,
  sentence_id uuid NOT NULL REFERENCES sentences ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted timestamp with time zone,
  PRIMARY KEY (sense_id, sentence_id)
);

CREATE OR REPLACE VIEW entries_view AS
SELECT
  entries.id AS id,
  entries.dictionary_id AS dictionary_id,
  entries.created_at,
  entries.updated_at,
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
          'source', audio.source,
          'speaker_ids', audio_speakers.speaker_ids
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
LEFT JOIN (
  SELECT
    audio_id,
    jsonb_agg(speaker_id) AS speaker_ids
  FROM audio_speakers
  WHERE deleted IS NULL
  GROUP BY audio_id
) AS audio_speakers ON audio_speakers.audio_id = audio.id
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
          'hosted_elsewhere', videos.hosted_elsewhere,
          'speaker_ids', video_speakers.speaker_ids
        )
      )
    ) AS videos
  FROM sense_videos
  JOIN videos ON videos.id = sense_videos.video_id
  LEFT JOIN (
    SELECT
      video_id,
      jsonb_agg(speaker_id) AS speaker_ids
    FROM video_speakers
    WHERE deleted IS NULL
    GROUP BY video_id
  ) AS video_speakers ON video_speakers.video_id = videos.id
  WHERE videos.deleted IS NULL AND sense_videos.deleted IS NULL
  GROUP BY sense_videos.sense_id
) AS aggregated_videos ON aggregated_videos.sense_id = senses.id
WHERE entries.deleted IS NULL
GROUP BY entries.id;



insert into
  dictionaries (id)
values
  ('dict1')
on conflict do nothing;

insert into
  entries (
    id,
    dictionary_id,
    lexeme,
    phonetic,
    interlinearization,
    morphology,
    notes,
    sources,
    scientific_names,
    coordinates,
    unsupported_fields,
    elicitation_id
  )
values
  (
    'entry1',
    'dict1',
    '{"word": "example"}',
    'ɪɡˈzæmpəl',
    'example',
    'noun',
    '{"note": "Sample note"}',
    array['source1', 'source2'],
    array['Homo sapiens'],
    '{"lat": 40.7128, "long": -74.0060}',
    '{"field": "value"}',
    'elic1'
  )
on conflict do nothing;

insert into
  senses (
    id,
    entry_id,
    definition,
    glosses,
    parts_of_speech,
    semantic_domains,
    write_in_semantic_domains,
    noun_class,
    plural_form,
    variant
  )
values
  (
    '550e8400-e29b-41d4-a716-446655440000',
    'entry1',
    '{"en": "A representative form or pattern"}',
    '{"en": "example"}',
    array['noun'],
    array['education'],
    array['learning'],
    'class1',
    '{"plural": "examples"}',
    '{"variant": "example"}'
  )
on conflict do nothing;

insert into
  sentences (id, dictionary_id, text, translation)
values
  (
    '550e8400-e29b-41d4-a716-446655440001',
    'dict1',
    '{"en": "This is an example sentence."}',
    '{"es": "Esta es una oración de ejemplo."}'
  )
on conflict do nothing;

insert into
  senses_in_sentences (sense_id, sentence_id)
values
  (
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001'
  )
on conflict do nothing;