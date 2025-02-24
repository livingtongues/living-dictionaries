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

-- CREATE OR REPLACE FUNCTION dictionaries_with_editors()
-- RETURNS TABLE (
--     id text,
--     name text,
--     alternate_names text[],
--     gloss_languages text[],
--     location text,
--     coordinates jsonb,
--     iso_639_3 text,
--     glottocode text,
--     public boolean,
--     print_access boolean,
--     metadata jsonb,
--     entry_count bigint,
--     orthographies jsonb[],
--     featured_image jsonb,
--     author_connection text,
--     community_permission public.certainty,
--     language_used_by_community boolean,
--     con_language_description text,
--     copyright text,
--     created_at timestamp with time zone,
--     created_by uuid,
--     updated_at timestamp with time zone,
--     updated_by uuid,
--     editors jsonb
-- ) AS $$
-- BEGIN
--     IF NOT is_admin() THEN
--         RETURN;
--     END IF;

--     RETURN QUERY
--     WITH editors_cte AS (
--         SELECT
--             dictionary_roles.dictionary_id,
--             jsonb_agg(
--                 jsonb_build_object(
--                     'user_id', auth.users.id,
--                     'email', auth.users.email::text,
--                     'full_name', auth.users.raw_user_meta_data->>'full_name',
--                     'avatar_url', auth.users.raw_user_meta_data->>'avatar_url',
--                     'role', dictionary_roles.role,
--                     'created_at', dictionary_roles.created_at,
--                     'invited_by', dictionary_roles.invited_by
--                 )
--             ) FILTER (WHERE dictionary_roles.dictionary_id IS NOT NULL) AS editors
--         FROM dictionary_roles
--         LEFT JOIN auth.users ON dictionary_roles.user_id = auth.users.id
--         GROUP BY dictionary_roles.dictionary_id
--     )
--     SELECT
--         dictionaries_view.id,
--         dictionaries_view.name,
--         dictionaries_view.alternate_names,
--         dictionaries_view.gloss_languages,
--         dictionaries_view.location,
--         dictionaries_view.coordinates,
--         dictionaries_view.iso_639_3,
--         dictionaries_view.glottocode,
--         dictionaries_view.public,
--         dictionaries_view.print_access,
--         dictionaries_view.metadata,
--         dictionaries_view.entry_count,
--         dictionaries_view.orthographies,
--         dictionaries_view.featured_image,
--         dictionaries_view.author_connection,
--         dictionaries_view.community_permission,
--         dictionaries_view.language_used_by_community,
--         dictionaries_view.con_language_description,
--         dictionaries_view.copyright,
--         dictionaries_view.created_at,
--         dictionaries_view.created_by,
--         dictionaries_view.updated_at,
--         dictionaries_view.updated_by,
--         COALESCE(editors_cte.editors, '[]'::jsonb) AS editors
--     FROM dictionaries_view
--     LEFT JOIN editors_cte ON dictionaries_view.id = editors_cte.dictionary_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;