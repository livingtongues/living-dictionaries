-- Photo EXIF capture: village-level GPS (blunted to 2 decimals ~1.1km ON INGEST —
-- house-level precision never reaches the DB) + the EXIF capture timestamp.
ALTER TABLE photos ADD COLUMN latitude REAL;
ALTER TABLE photos ADD COLUMN longitude REAL;
ALTER TABLE photos ADD COLUMN taken_at TEXT;
