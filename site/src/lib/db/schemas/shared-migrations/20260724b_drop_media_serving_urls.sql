------------------------------------------------------------------
-- R2-only media cutover: image URLs are derived from storage paths.
------------------------------------------------------------------
ALTER TABLE dictionary_partners DROP COLUMN photo_serving_url;
ALTER TABLE featured_entries DROP COLUMN photo_serving_url;
