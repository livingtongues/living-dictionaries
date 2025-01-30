DROP MATERIALIZED VIEW materialized_dictionaries_view;

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
  con_language_description,
  entry_count
FROM dictionaries_view;

CREATE UNIQUE INDEX idx_materialized_dictionaries_view_id ON materialized_dictionaries_view (id);

REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_entries_view;