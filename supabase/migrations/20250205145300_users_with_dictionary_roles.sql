CREATE OR REPLACE FUNCTION users_with_dictionary_roles()
RETURNS TABLE (
    id uuid,
    email text,
    full_name text,
    avatar_url text,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    unsubscribed_from_emails timestamp with time zone,
    terms_agreement timestamp with time zone,
    dictionary_roles jsonb
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
        user_data.terms_agreement,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'dictionary_id', dictionary_roles.dictionary_id,
                    'role', dictionary_roles.role,
                    'created_at', dictionary_roles.created_at,
                    'invited_by', dictionary_roles.invited_by
                )
            ) FILTER (WHERE dictionary_roles.dictionary_id IS NOT NULL), 
            '[]'::jsonb
        ) AS dictionary_roles
    FROM auth.users
    LEFT JOIN user_data ON auth.users.id = user_data.id
    LEFT JOIN dictionary_roles ON auth.users.id = dictionary_roles.user_id
    GROUP BY auth.users.id, user_data.unsubscribed_from_emails, user_data.terms_agreement;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
