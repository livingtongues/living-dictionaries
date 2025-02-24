CREATE TABLE dictionary_info (
  id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  about text,
  grammar text,
  citation text,
  write_in_collaborators text[],
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users default auth.uid(),
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users default auth.uid(),
  PRIMARY KEY (id)
);

ALTER TABLE dictionary_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can insert dictionary info."
ON dictionary_info FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_info.id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Managers can update dictionary info."
ON dictionary_info FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_info.id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Anyone can view dictionary info."
ON dictionary_info FOR SELECT
USING (true);

------------------------

CREATE TABLE dictionary_partners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  name text NOT NULL,
  photo_id uuid REFERENCES photos,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users default auth.uid(),
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users default auth.uid()
);

ALTER TABLE dictionary_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can add, edit, remove dictionary partners."
ON dictionary_partners FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_partners.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_partners.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Anyone can view dictionary partners."
ON dictionary_partners FOR SELECT
USING (true);