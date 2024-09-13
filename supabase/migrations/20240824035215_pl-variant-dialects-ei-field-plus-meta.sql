ALTER TABLE entries
DROP COLUMN plural_form,
DROP COLUMN variant;

ALTER TABLE senses
ADD COLUMN plural_form jsonb, -- MultiString
ADD COLUMN variant jsonb; -- MultiString

ALTER TABLE entries
DROP COLUMN dialects;

CREATE TABLE dialects (
  id uuid unique primary key NOT NULL,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  name jsonb NOT NULL, -- MultiString
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE dialects ENABLE ROW LEVEL SECURITY;

CREATE TABLE entry_dialects (
  entry_id text NOT NULL REFERENCES entries ON DELETE CASCADE,
  dialect_id uuid NOT NULL REFERENCES dialects ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted timestamp with time zone,
  PRIMARY KEY (entry_id, dialect_id)
);

ALTER TABLE entry_dialects ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_created_by_trigger_dialects
BEFORE UPDATE ON dialects
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

ALTER TYPE content_tables ADD VALUE 'dialects';

ALTER TABLE content_updates
ADD COLUMN dialect_id uuid REFERENCES dialects,
ADD COLUMN addition jsonb,
ALTER COLUMN change DROP NOT NULL;

------------------

ALTER TABLE entries
ALTER COLUMN notes TYPE jsonb USING notes::jsonb, -- MultiString (was text previously)
ADD COLUMN unsupported_fields jsonb, -- to place fields from imports like FLEx that don't fit into the current fields
ADD COLUMN elicitation_id text; -- Elicitation Id for Munda languages or Swadesh Composite number list from Comparalex, used for Onondaga custom sort
