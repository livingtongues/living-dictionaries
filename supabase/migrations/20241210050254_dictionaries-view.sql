CREATE VIEW dictionaries_view AS
SELECT
  dictionaries.id,
  name,
  alternate_names,
  gloss_languages,
  location,
  dictionaries.coordinates,
  iso_639_3,
  glottocode,
  public,
  dictionaries.metadata,
  COUNT(entries.id) AS entry_count,
  -- just for admin table, below not included in the materialized view
  orthographies,
  featured_image,
  author_connection,
  community_permission,
  con_language_description,
  copyright,
  dictionaries.created_at,
  dictionaries.created_by,
  dictionaries.updated_at,
  dictionaries.updated_by
FROM dictionaries
  LEFT JOIN entries ON entries.dictionary_id = dictionaries.id AND entries.deleted IS NULL -- take out the LEFT to eliminate dictionaries with 0 entries
WHERE dictionaries.deleted IS NULL
GROUP BY dictionaries.id;

CREATE MATERIALIZED VIEW materialized_dictionaries_view AS
SELECT 
  id,
  name,
  alternate_names,
  gloss_languages,
  location,
  coordinates,
  iso_639_3,
  glottocode,
  public,
  metadata,
  entry_count
FROM dictionaries_view; -- DROP MATERIALIZED VIEW materialized_dictionaries_view

CREATE UNIQUE INDEX idx_materialized_dictionaries_view_id ON materialized_dictionaries_view (id); -- When you refresh data for a materialized view, PostgreSQL locks the underlying tables. To avoid this, use the CONCURRENTLY option so that PostgreSQL creates a temporary updated version of the materialized view, compares two versions, and performs INSERT and UPDATE on only the differences. To use CONCURRENTLY the materialized view must have a UNIQUE index:

SELECT cron.schedule (
    'refresh-materialized_dictionaries_view', -- Job name
    '0 * * * *', -- Every hour, you can re-run this SQL with a new time amount to change the frequency
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_dictionaries_view $$
); -- SELECT cron.unschedule('refresh-materialized_dictionaries_view');
