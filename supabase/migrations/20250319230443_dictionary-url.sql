ALTER TABLE dictionaries ADD COLUMN url TEXT;
UPDATE dictionaries SET url = id;
ALTER TABLE dictionaries ALTER COLUMN url SET NOT NULL;
ALTER TABLE dictionaries ADD CONSTRAINT dictionary_url_unique UNIQUE (url);

DROP MATERIALIZED VIEW materialized_dictionaries_view;
DROP MATERIALIZED VIEW materialized_admin_dictionaries_view;
DROP VIEW dictionaries_view;

CREATE VIEW dictionaries_view AS
SELECT
  dictionaries.id,
  url,
  name,
  alternate_names,
  gloss_languages,
  location,
  dictionaries.coordinates,
  iso_639_3,
  glottocode,
  public,
  print_access,
  dictionaries.metadata,
  COUNT(entries.id) AS entry_count,
  orthographies,
  featured_image,
  author_connection,
  community_permission,
  language_used_by_community,
  con_language_description,
  copyright,
  dictionaries.created_at,
  dictionaries.created_by,
  dictionaries.updated_at,
  dictionaries.updated_by
FROM dictionaries
  LEFT JOIN entries ON entries.dictionary_id = dictionaries.id AND entries.deleted IS NULL
WHERE dictionaries.deleted IS NULL
GROUP BY dictionaries.id
ORDER BY name;

CREATE MATERIALIZED VIEW materialized_admin_dictionaries_view AS
SELECT * FROM dictionaries_view;
CREATE UNIQUE INDEX idx_materialized_admin_dictionaries_view_id ON materialized_admin_dictionaries_view (id); 

CREATE MATERIALIZED VIEW materialized_dictionaries_view AS
SELECT 
  id,
  url,
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

REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_admin_dictionaries_view;
REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_dictionaries_view;