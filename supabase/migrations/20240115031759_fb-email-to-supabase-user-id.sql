CREATE OR REPLACE FUNCTION convert_firebase_email_to_supabase_user_id()
RETURNS TRIGGER AS $$
DECLARE
    fetched_user_id UUID;
BEGIN
    SELECT id INTO fetched_user_id
    FROM auth.users
    WHERE email = NEW.user_id;

    IF fetched_user_id IS NOT NULL THEN
        NEW.user_id := fetched_user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER convert_email_to_id_before_insert
BEFORE INSERT ON entry_updates
FOR EACH ROW 
EXECUTE FUNCTION convert_firebase_email_to_supabase_user_id();
