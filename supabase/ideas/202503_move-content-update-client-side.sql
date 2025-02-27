ALTER TABLE photos
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ALTER COLUMN updated_by SET DEFAULT auth.uid();

CREATE POLICY "Users can insert photos for dictionaries they manage or contribute to"
ON photos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = photos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update photos for dictionaries they manage or contribute to"
ON photos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = photos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
  )
);

-- continue through rest of tables