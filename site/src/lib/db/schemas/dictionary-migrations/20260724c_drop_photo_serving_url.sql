------------------------------------------------------------------
-- R2-only media cutover: photo URLs are derived from storage_path.
------------------------------------------------------------------
ALTER TABLE photos DROP COLUMN serving_url;
