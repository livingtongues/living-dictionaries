-- public entries
SELECT COUNT(entries.id) AS count
FROM entries
JOIN dictionaries ON entries.dictionary_id = dictionaries.id
WHERE dictionaries.public = TRUE AND entries.deleted IS NULL;

254813

-- total entries
SELECT COUNT(entries.id) AS count
FROM entries
WHERE entries.deleted IS NULL;

449350