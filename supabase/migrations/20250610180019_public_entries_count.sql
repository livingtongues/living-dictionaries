CREATE OR REPLACE VIEW public_entries_count AS
SELECT COUNT(entries.id) AS count
FROM entries
JOIN dictionaries ON entries.dictionary_id = dictionaries.id
WHERE dictionaries.public = TRUE AND entries.deleted IS NULL;