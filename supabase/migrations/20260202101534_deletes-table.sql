-- Deletes table for sync: stores delete operations to propagate across devices
CREATE TABLE deletes (
  table_name TEXT NOT NULL,
  id TEXT NOT NULL,  -- text to handle both uuid and text PKs, use | separator for composite keys
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  deleted_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (table_name, id)
);

ALTER TABLE deletes ENABLE ROW LEVEL SECURITY;

-- RLS policies for deletes table (admins only for now)
CREATE POLICY "Admins can view deletes"
ON deletes FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'admin')::int = 1);

CREATE POLICY "Admins can insert deletes"
ON deletes FOR INSERT
TO authenticated
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'admin')::int = 1);

-- Trigger function to cascade deletes to the actual tables
CREATE OR REPLACE FUNCTION process_delete_record()
RETURNS TRIGGER AS $$
DECLARE
  parts TEXT[];
BEGIN
  -- Handle composite keys (dictionary_roles uses | separator)
  IF NEW.table_name = 'dictionary_roles' THEN
    -- Parse composite key: dictionary_id|user_id|role
    parts := string_to_array(NEW.id, '|');
    DELETE FROM dictionary_roles 
    WHERE dictionary_id = parts[1] 
      AND user_id = parts[2]::uuid 
      AND role = parts[3]::role_enum;
  ELSIF NEW.table_name = 'invites' THEN
    DELETE FROM invites WHERE id = NEW.id::uuid;
  ELSIF NEW.table_name = 'dictionaries' THEN
    DELETE FROM dictionaries WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER process_delete_trigger
AFTER INSERT ON deletes
FOR EACH ROW EXECUTE FUNCTION process_delete_record();
