CREATE TABLE senses (
  id uuid unique primary key NOT NULL, -- generated on client so users can create a sense offline and keep editing it
  entry_id text NOT NULL,-- added REFERENCES entries
  "definition" jsonb, -- MultiString
  glosses jsonb, -- MultiString
  parts_of_speech text[],
  semantic_domains text[],
  write_in_semantic_domains text[],
  noun_class character varying,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by text NOT NULL, -- TODO: go through existing senses and connect to user_id, then change to uuid and add REFERENCES auth.users
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by text NOT NULL, -- TODO: go through existing senses and connect to user_id, then change to uuid and add REFERENCES auth.users
  deleted timestamp with time zone
  -- added plural_form jsonb, -- MultiString
  -- added variant jsonb -- MultiString
);

ALTER TABLE senses ENABLE ROW LEVEL SECURITY;

CREATE VIEW entries_view AS -- out of date
SELECT
  entry_id as id,
  jsonb_agg(
    jsonb_strip_nulls(
      jsonb_build_object(
        'id', id,
        'glosses', glosses,
        'parts_of_speech', parts_of_speech,
        'semantic_domains', semantic_domains,
        'write_in_semantic_domains', write_in_semantic_domains,
        'noun_class', noun_class,
        'definition', "definition"
      )
    )
    ORDER BY created_at
  ) AS senses
FROM senses
WHERE deleted IS NULL
GROUP BY entry_id;

CREATE TYPE entry_tables AS ENUM ('senses'); -- not using
CREATE TYPE entry_columns AS ENUM ('deleted', 'glosses', 'parts_of_speech', 'semantic_domains', 'write_in_semantic_domains', 'noun_class', 'definition'); -- not using

CREATE TABLE entry_updates ( -- TODO: drop this table
  id uuid unique primary key NOT NULL,
  user_id text NOT NULL,
  dictionary_id text NOT NULL,
  entry_id text NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  "table" entry_tables NOT NULL,
  "row" text NOT NULL,
  "column" entry_columns NOT NULL,
  new_value text,
  old_value text
);

ALTER TABLE entry_updates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION apply_entry_updates() -- removed
RETURNS TRIGGER AS $$
DECLARE
  column_data_type regtype;
BEGIN
  SELECT atttypid::regtype INTO column_data_type
  FROM pg_attribute
  WHERE attrelid = (SELECT oid FROM pg_class WHERE relname = NEW.table::text)
    AND attname = NEW.column::text;
  
  EXECUTE format(
    'INSERT INTO %I 
    (id, entry_id, %I, created_by, updated_by, created_at, updated_at) 
    VALUES ($1::uuid, $2, $3::%s, $4, $4, now(), now()) 
    ON CONFLICT (id) DO UPDATE 
    SET %I = $3::%s, updated_by = $4, updated_at = now()', 
    NEW.table, 
    NEW.column,
    column_data_type,
    NEW.column,
    column_data_type
  ) USING NEW.row, NEW.entry_id, NEW.new_value, NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_entry_updates -- removed
AFTER INSERT ON entry_updates
FOR EACH ROW
EXECUTE FUNCTION apply_entry_updates();