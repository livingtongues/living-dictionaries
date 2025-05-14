CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  can_write boolean,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users default auth.uid(),
  last_read_at timestamp with time zone,
  last_write_at timestamp with time zone,
  use_count integer DEFAULT 0 NOT NULL
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can add, view, edit, remove api keys."
ON api_keys FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = api_keys.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = api_keys.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);