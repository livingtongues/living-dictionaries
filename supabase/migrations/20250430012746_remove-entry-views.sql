SELECT cron.unschedule('refresh-materialized_entries_view');
DROP FUNCTION entries_from_timestamp(timestamp with time zone, text) CASCADE;
DROP FUNCTION entry_by_id(text) CASCADE;
-- below is already dropped by above cascades
-- DROP VIEW IF EXISTS entries_view CASCADE; 
-- DROP MATERIALIZED VIEW IF EXISTS materialized_entries_view CASCADE;
-- DROP INDEX IF EXISTS idx_materialized_entries_view_id CASCADE;
-- DROP INDEX IF EXISTS idx_materialized_entries_view_updated_at_dictionary_id CASCADE;