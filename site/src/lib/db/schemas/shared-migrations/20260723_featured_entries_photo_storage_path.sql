------------------------------------------------------------------
-- Media R2 migration Phase 2 (photos): featured_entries snapshots the photo at
-- curation time; add the storage_path so R2-convention photos render via
-- `photo_src` (photo_serving_url stays as the legacy-lh3 fallback). Backfilled
-- from dict.dbs via photo_id by the migration driver.
------------------------------------------------------------------
ALTER TABLE featured_entries ADD COLUMN photo_storage_path TEXT;
