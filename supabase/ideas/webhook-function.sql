CREATE OR REPLACE FUNCTION webhooks_func()
	RETURNS TRIGGER
	SECURITY DEFINER
	LANGUAGE plpgsql
	AS $$
DECLARE
	url text;
	function_name text := TG_ARGV[0]::text;
	project_id text;
	project_env text DEFAULT 'LOCAL';
	payload jsonb;
	headers jsonb;
	request_id bigint;
	timeout_ms integer DEFAULT 1000;
BEGIN
	--
	--
	IF function_name IS NULL THEN
		RAISE EXCEPTION 'function_name cannot be null';
	END IF;
	--
	-- GET URL ENDPOINT
	SELECT
		decrypted_secret
	FROM
		vault.decrypted_secrets
	WHERE
		name = 'project_id'
	LIMIT 1 INTO project_id;
	--
	-- GET ENV
	SELECT
		decrypted_secret
	FROM
		vault.decrypted_secrets
	WHERE
		name = 'project_env'
	LIMIT 1 INTO project_env;
	--
	--
	IF project_id IS NULL THEN
		url := 'http://172.17.0.1:54321';
	ELSE
		url := 'https://' || project_id || '.supabase.co';
	END IF;
	--
	--
	IF project_env IS NULL THEN
		project_env := 'LOCAL';
	END IF;
	--
	--
	headers := '{"Content-type":"application/json"}'::jsonb;
	--
	--
	payload := jsonb_build_object('old_record', OLD, 'record', NEW, 'type', TG_OP, 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA, 'env', project_env);
	--
	--
	SELECT
		http_post INTO request_id
	FROM
		net.http_post(url || '/functions/v1/' || function_name, payload, '{}'::jsonb, headers, timeout_ms);
	--
	--
	INSERT INTO supabase_functions.hooks(
		hook_table_id,
		hook_name,
		request_id)
	VALUES (
		TG_RELID,
		TG_NAME,
		request_id);
	--
	--
	RETURN NEW;
END
$$;

CREATE OR REPLACE TRIGGER webhook_after_insert_tbl_org_members
	AFTER INSERT ON tbl_org_members
	FOR EACH ROW
	EXECUTE FUNCTION webhooks_func('invite-members');


-- CREATE TRIGGER apply_content_updates 
-- AFTER INSERT ON content_updates
-- FOR EACH ROW
-- EXECUTE FUNCTION supabase_functions.http_request(
--   'http://localhost:3000',
--   'POST',
--   '{"Content-Type":"application/json"}',
--   '{}',
--   '1000'
-- );

-- select
--   "status", "content"::jsonb
-- from
--   http_post(
--     'https://jsonplaceholder.typicode.com/posts',
--     '{ "title": "foo", "body": "bar", "userId": 1 }',
--     'application/json'
--   );