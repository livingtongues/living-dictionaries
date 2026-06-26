CREATE OR REPLACE FUNCTION get_my_claim(claim TEXT) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  	coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' -> claim, null)
$$;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN
    LANGUAGE sql STABLE
    AS $$
  SELECT coalesce(get_my_claim('admin')::numeric, 0) > 0
$$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('
            CREATE POLICY "Admin level 1 can perform any action on %I"
            ON %I FOR ALL
            TO authenticated
            USING (is_admin())
            WITH CHECK (is_admin());
        ', r.tablename, r.tablename);
    END LOOP;
END $$;
