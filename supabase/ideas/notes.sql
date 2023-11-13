CREATE TYPE user_role AS ENUM ('data-admin', 'dev-admin');

CREATE TABLE user_profiles (
  id uuid references auth.users (id) primary key NOT NULL,
  name text NOT NULL,
  role user_role,
  agree_to_terms timestamp with time zone,
  unsubscribe_from_announcements timestamp with time zone,
);

-- TODO: add editors table to store managers and contributors

CREATE TABLE dictionaries (
  id uuid text unique primary key NOT NULL,
  CONSTRAINT proper_dictionary_id CHECK (id ~ '^[a-zA-Z0-9_-]+$'),
  CONSTRAINT dictionary_id_length CHECK (char_length(id) > 2 and char_length(id) <= 20),
);

CREATE TABLE dictionary_updates (

);



CREATE TABLE entry_updates (

);

CREATE TABLE senses (
  id bigint generated always as identity primary key,
  -- entry_id uuid REFERENCES entries (id) NOT NULL, -- will be turned on once Firebase data migrated
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users (id) NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid REFERENCES auth.users (id) NOT NULL,
  glosses jsonb,
  noun_class character varying,
  write_in_semantic_domains jsonb,
  definition_english_deprecated text,
);



CREATE TABLE videos (

);

CREATE TABLE photos (

);

CREATE TABLE audio (

);

CREATE TABLE audio_updates (

);
-- referenced by videos table (junction many-many)
-- referenced by photos table (junction many-many)


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

CREATE TRIGGER trg_make_archive_of_changes_for_senses
AFTER INSERT OR DELETE OR UPDATE ON senses
FOR EACH ROW EXECUTE FUNCTION make_archive_of_changes('Senses');