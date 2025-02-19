CREATE VIEW profiles_view AS
SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' AS full_name,
    raw_user_meta_data->>'avatar_url' AS avatar_url
FROM auth.users;
REVOKE ALL ON public.profiles_view FROM anon, authenticated, public;

CREATE TABLE user_data (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  welcome_email_sent timestamp with time zone,
  unsubscribed_from_emails timestamp with time zone,
  terms_agreement timestamp with time zone
);

ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their user_data." 
ON user_data FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their user_data." 
ON user_data FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  result INT;
BEGIN
  INSERT INTO public.user_data (id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE handle_new_user();