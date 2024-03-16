CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- https://pgtap.org/documentation.html
BEGIN;
SELECT plan(4);

-- the first three tests are testing the same thing in different ways and amounts. First is simplest, second is most comprehensive but breaks if we simple update the seed values, last is hardest to understand and so commented out. Still learning about best testing options
SELECT ok(
  EXISTS( -- use NOT EXISTS to test the inverse
    SELECT 1
    FROM entries_view
    WHERE id = 'entry1'
      AND senses @> '[{"sentences": [{"id": "11111111-1111-1111-1111-1111111111a1"}]}]'::jsonb
  ),
  'entry 1 sense 1 should include sentence 1'
);

\set expected '[{"id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001", "sentences": [{"id": "11111111-1111-1111-1111-1111111111a1", "text": "Hi, I am a sentence connected to the first sense of the first entry.", "translation": {"es": "Hola, soy una oración de ejemplo para el primer sentido de la primera entrada."}}, {"id": "11111111-1111-1111-1111-1111111111a4", "text": "Hi, I should be the second sentence connected to the first sense of the first entry."}], "noun_class": "2", "parts_of_speech": ["n", "v"]}, {"id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeefff002", "glosses": {"en": "Hi", "es": "Hola"}}]'

SELECT is(
  (
    SELECT senses::text
    FROM entries_view
    WHERE id = 'entry1'
  )::text,
  :'expected',
  'entry1 includes two sentences'
);

-- SELECT is(
--   CAST((
--     SELECT count(*)
--     FROM entries_view
--     CROSS JOIN LATERAL jsonb_array_elements(senses) AS sense
--     CROSS JOIN LATERAL jsonb_array_elements(sense->'sentences') AS sentence
--     WHERE id = 'entry1'
--       AND sentence->>'id' = '11111111-1111-1111-1111-1111111111a1'
--   ) AS integer),
--   1,
--   'Check for existence of sentence with id 11111111-1111-1111-1111-1111111111a1 in entry1 senses'
-- );

SELECT isnt(
  jsonb_typeof(
    (
      SELECT senses
      FROM entries_view
      WHERE id = 'entry1'
    ) -> 1 -> 'sentences'
  ),
  'array',
  'The entry 1 sense 2 does not contain a sentences array'
);

SELECT ok(
  EXISTS(
    SELECT 1
    FROM entries_view
    WHERE id = 'entry2'
      AND senses @> '[{"sentences": [{"id": "11111111-1111-1111-1111-1111111111a3"}]}]'::jsonb
  ),
  'entry 2 sense 1 should include sentence 3'
);

SELECT * FROM finish();
ROLLBACK;
