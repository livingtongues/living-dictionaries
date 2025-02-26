create trigger handle_updated_at before update on user_data
  for each row execute procedure moddatetime (updated_at);

DROP FUNCTION users_with_dictionary_roles();

CREATE FUNCTION users_for_admin_table()
RETURNS TABLE (
    id uuid,
    email text,
    full_name text,
    avatar_url text,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    unsubscribed_from_emails timestamp with time zone,
    updated_at timestamp with time zone
) AS $$
BEGIN
    IF NOT is_admin() THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        auth.users.id,
        auth.users.email::text,
        auth.users.raw_user_meta_data->>'full_name' AS full_name,
        auth.users.raw_user_meta_data->>'avatar_url' AS avatar_url,
        auth.users.last_sign_in_at,
        auth.users.created_at,
        user_data.unsubscribed_from_emails,
        COALESCE(user_data.updated_at, auth.users.last_sign_in_at) AS updated_at
    FROM auth.users
    LEFT JOIN user_data ON auth.users.id = user_data.id
    GROUP BY auth.users.id, user_data.unsubscribed_from_emails, user_data.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;