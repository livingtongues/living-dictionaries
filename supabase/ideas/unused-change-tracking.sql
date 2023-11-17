-- functions for created_at and updated_at from https://code.build/p/MpCtTTkYvzRGSRqQFzxTuY/supabase-date-protection-on-postgresql https://github.com/orgs/supabase/discussions/6741
CREATE FUNCTION insert_dates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = now();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION update_dates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.created_at = OLD.created_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER senses_update_dates
BEFORE UPDATE ON senses
FOR EACH ROW EXECUTE FUNCTION update_dates();

CREATE TRIGGER senses_insert_dates
BEFORE INSERT ON senses
FOR EACH ROW EXECUTE FUNCTION insert_dates();


-- change history logging
CREATE TRIGGER create_senses_change
AFTER INSERT OR UPDATE ON senses
FOR EACH ROW
EXECUTE FUNCTION create_senses_change_function();

-- https://www.thegnar.com/blog/history-tracking-with-postgres and https://dev.to/mistval/database-architecture-history-over-state-3m8o
CREATE FUNCTION make_archive_of_changes() RETURNS TRIGGER AS $$
-- Expects one argument, the record_type
-- It's the stringified ActiveRecord class name
-- For example 'User', or 'Account'
BEGIN
  -- Previous snapshots should be marked as stale
  -- This little denormalization trick is so thaActiveRecord
  -- can immediately pull up the most recent snapshowithout
  -- having to sort through all the records by theitimestamps
  UPDATE archives
  SET most_recent = FALSE
  WHERE
    table_name = TG_TABLE_NAME
    AND most_recent = TRUE
    AND record_type = record_type
    AND record_id = (
      CASE WHEN TG_OP = 'DELETE'
        THEN OLD.id
        ELSE NEW.id
      END
    )
  IF TG_OP = 'INSERT' THEN
    INSERT INTO archives (
      table_name, record_type, record_id, operationnew_values, most_recent, recorded_at
    )
    VALUES (
      TG_TABLE_NAME, TG_ARGV[0], NEW.id, TG_OProw_to_json(NEW), TRUE, now() -- TODO: probably just use row_to_json(NEW)
    );
    RETURN NEW
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO archives (
      table_name, record_type, record_id, operationnew_values, old_values, most_recent, recorded_at
    )
    VALUES (
      TG_TABLE_NAME, TG_ARGV[0], NEW.id, TG_OProw_to_json(NEW), row_to_json(OLD), TRUE, now()
    );
    RETURN NEW
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO archives (
      table_name, record_type, record_id, operationold_values, most_recent, recorded_at
    )
    VALUES (
      TG_TABLE_NAME, TG_ARGV[0], OLD.id, TG_OProw_to_json(OLD), TRUE, now()
    );
    RETURN OLD
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_make_archive_of_changes_for_entries
AFTER INSERT OR DELETE OR UPDATE ON entries
FOR EACH ROW EXECUTE FUNCTION make_archive_of_changes('Entries');