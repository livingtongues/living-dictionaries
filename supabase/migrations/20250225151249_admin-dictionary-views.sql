CREATE MATERIALIZED VIEW materialized_admin_dictionaries_view AS
SELECT * FROM dictionaries_view;
CREATE UNIQUE INDEX idx_materialized_admin_dictionaries_view_id ON materialized_admin_dictionaries_view (id); -- When you refresh data for a materialized view, PostgreSQL locks the underlying tables. To avoid this, use the CONCURRENTLY option so that PostgreSQL creates a temporary updated version of the materialized view, compares two versions, and performs INSERT and UPDATE on only the differences. To use CONCURRENTLY the materialized view must have a UNIQUE index:
SELECT cron.schedule (
    'refresh-materialized_admin_dictionaries_view', -- Job name
    '0 0 * * *', -- Every day, you can re-run this SQL with a new time amount to change the frequency
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_admin_dictionaries_view $$
); -- SELECT cron.unschedule('refresh-materialized_dictionaries_view');

create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at before update on dictionaries
  for each row execute procedure moddatetime (updated_at);