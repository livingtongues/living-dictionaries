SELECT
  dictionaries.id,
  COUNT(entries.id) AS entry_count
FROM
  dictionaries
  LEFT JOIN entries ON entries.dictionary_id = dictionaries.id -- take out the LEFT to eliminate dictionaries with 0 entries
GROUP BY
  dictionaries.id
ORDER BY
  entry_count;



SELECT
  dictionaries.id,
  COUNT(entries.id) AS entry_count
FROM
  dictionaries
  LEFT JOIN entries ON entries.dictionary_id = dictionaries.id -- take out the LEFT to eliminate dictionaries with 0 entries
WHERE entries.updated_at > '1970-01-01 01:00:00+00'
GROUP BY
  dictionaries.id
ORDER BY
  entry_count;