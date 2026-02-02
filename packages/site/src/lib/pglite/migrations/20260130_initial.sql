CREATE TABLE migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  run_on timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE db_metadata (
  key text PRIMARY KEY,
  value text
);

-- Admin tables for PGlite sync

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  last_sign_in_at timestamp with time zone,
  created_at timestamp with time zone,
  unsubscribed_from_emails timestamp with time zone,
  updated_at timestamp with time zone NOT NULL,
  local_saved_at timestamp with time zone
);

CREATE TABLE user_data (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  terms_agreement timestamp with time zone,
  unsubscribed_from_emails timestamp with time zone,
  welcome_email_sent timestamp with time zone,
  updated_at timestamp with time zone NOT NULL,
  local_saved_at timestamp with time zone
);

CREATE TABLE dictionaries (
  id text PRIMARY KEY,
  name text NOT NULL,
  alternate_names text[],
  gloss_languages text[],
  location text,
  coordinates jsonb,
  iso_639_3 text,
  glottocode text,
  public boolean,
  print_access boolean,
  metadata jsonb,
  entry_count integer,
  orthographies jsonb,
  featured_image jsonb,
  author_connection text,
  community_permission text,
  language_used_by_community boolean,
  con_language_description text,
  copyright text,
  url text,
  created_at timestamp with time zone NOT NULL,
  created_by uuid,
  updated_at timestamp with time zone NOT NULL,
  updated_by uuid,
  local_saved_at timestamp with time zone
);

CREATE TABLE dictionary_roles (
  dictionary_id text NOT NULL REFERENCES dictionaries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  invited_by uuid,
  local_saved_at timestamp with time zone,
  PRIMARY KEY (dictionary_id, user_id, role)
);

CREATE TABLE invites (
  id uuid PRIMARY KEY,
  dictionary_id text NOT NULL REFERENCES dictionaries(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inviter_email text NOT NULL,
  target_email text NOT NULL,
  role text NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  local_saved_at timestamp with time zone
);

CREATE TABLE deletes (
  table_name text NOT NULL,
  id text NOT NULL,
  local_saved_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (table_name, id)
);

-- Trigger function to handle local_saved_at
-- When epoch is passed, convert to NULL (marks row as synced)
-- When NULL is passed, set to now() (marks row as dirty/locally modified)
CREATE OR REPLACE FUNCTION set_local_saved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.local_saved_at = 'epoch'::timestamptz THEN
    NEW.local_saved_at := NULL;
    RETURN NEW;
  END IF;
  IF NEW.local_saved_at IS NULL THEN
    NEW.local_saved_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply local_saved_at trigger to all syncable tables
CREATE TRIGGER set_local_saved_at_trigger
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_local_saved_at();

CREATE TRIGGER set_local_saved_at_trigger
BEFORE INSERT OR UPDATE ON user_data
FOR EACH ROW EXECUTE FUNCTION set_local_saved_at();

CREATE TRIGGER set_local_saved_at_trigger
BEFORE INSERT OR UPDATE ON dictionaries
FOR EACH ROW EXECUTE FUNCTION set_local_saved_at();

CREATE TRIGGER set_local_saved_at_trigger
BEFORE INSERT OR UPDATE ON dictionary_roles
FOR EACH ROW EXECUTE FUNCTION set_local_saved_at();

CREATE TRIGGER set_local_saved_at_trigger
BEFORE INSERT OR UPDATE ON invites
FOR EACH ROW EXECUTE FUNCTION set_local_saved_at();

-- Trigger function to process deletes
-- When a row is inserted into deletes, cascade delete to the actual table
CREATE OR REPLACE FUNCTION process_delete()
RETURNS TRIGGER AS $$
DECLARE
  parts text[];
BEGIN
  IF NEW.table_name = 'dictionary_roles' THEN
    parts := string_to_array(NEW.id, '|');
    DELETE FROM dictionary_roles
    WHERE dictionary_id = parts[1]
      AND user_id = parts[2]::uuid
      AND role = parts[3];
  ELSIF NEW.table_name = 'invites' THEN
    DELETE FROM invites WHERE id = NEW.id::uuid;
  ELSIF NEW.table_name = 'dictionaries' THEN
    DELETE FROM dictionaries WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_delete_trigger
AFTER INSERT ON deletes
FOR EACH ROW EXECUTE FUNCTION process_delete();
