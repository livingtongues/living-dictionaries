CREATE OR REPLACE VIEW entries_view AS
SELECT
  senses.entry_id AS id,
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
        'sentences', sentence_agg.sentences
      )
    )
    ORDER BY senses.created_at
  ) AS senses
FROM senses
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
) AS sentence_agg ON sentence_agg.sense_id = senses.id
WHERE senses.deleted IS NULL -- need to remove this and do client side in future as explained below
GROUP BY senses.entry_id;

-- Future plan:
-- Jim has viewed (and cached) 20 entries from yesterday and older
-- Bob deletes 1 today
-- Jim will have 20 cached entries and then loads fresh entries (including deleted) when he comes today so that he gets Bob's deleted today - we want that deleted to come down to Jim so that his browser knows to pull that deleted entry from the cache
-- Jim's entries are now updated in his cache as of today, so he will never again pull that deleted.
-- If we have new Jill tomorrow, in her fetch of the entire dictionary, don't pull down anything deleted because it's irrelevant - she has nothing in her cache to delete.