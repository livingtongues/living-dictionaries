ALTER TABLE photos
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ALTER COLUMN updated_by SET DEFAULT auth.uid();

ALTER TABLE dictionaries
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ALTER COLUMN updated_by SET DEFAULT auth.uid();

CREATE POLICY "Users can create dictionaries."
ON dictionaries FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = created_by 
    AND auth.uid() = updated_by 
    AND length(id) >= 3
);

CREATE TYPE role_enum AS ENUM ('manager', 'contributor');

CREATE TABLE dictionary_roles (
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE DEFAULT auth.uid(),
  role role_enum NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  invited_by uuid REFERENCES auth.users,
  PRIMARY KEY (dictionary_id, user_id, role)
);

ALTER TABLE dictionary_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and contributors can view dictionary roles."
ON dictionary_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE FUNCTION add_manager_on_new_dictionary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.dictionary_roles (dictionary_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'manager');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_dictionary_created
AFTER INSERT ON public.dictionaries
FOR EACH ROW EXECUTE PROCEDURE add_manager_on_new_dictionary();

CREATE POLICY "Managers can remove contributors."
ON dictionary_roles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_roles.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Managers can update dictionaries."
ON dictionaries FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionaries.id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE VIEW dictionary_roles_with_profiles AS
SELECT 
  dictionary_roles.dictionary_id,
  dictionary_roles.user_id,
  dictionary_roles.role,
  profiles_view.full_name,
  profiles_view.avatar_url
FROM 
  dictionary_roles
JOIN 
  profiles_view ON dictionary_roles.user_id = profiles_view.id;

CREATE TYPE status_enum AS ENUM ('queued', 'sent', 'claimed', 'cancelled');

CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  inviter_email text NOT NULL,
  target_email text NOT NULL,
  role role_enum NOT NULL,
  status status_enum NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users default auth.uid()
);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can do everything on invites."
ON invites FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = invites.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = invites.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Invited users can view their invites."
ON invites FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'email' = invites.target_email
);

CREATE POLICY "Invited users can mark their invites claimed."
ON invites FOR UPDATE
TO authenticated
USING (auth.jwt() ->> 'email' = invites.target_email);

CREATE POLICY "Invited users can add themselves to the dictionary roles."
ON dictionary_roles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM invites
    WHERE invites.dictionary_id = dictionary_roles.dictionary_id
      AND invites.role = dictionary_roles.role
      AND invites.target_email = auth.jwt() ->> 'email'
      AND invites.status = 'sent'
  )
);
