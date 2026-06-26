-- CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

create function supabase_url()
returns text
language plpgsql
security definer
as $$
declare
  project_id text;
begin
  SELECT
		decrypted_secret
	FROM
		vault.decrypted_secrets
	WHERE
		name = 'project_id'
	LIMIT 1 INTO project_id;

  IF project_id IS NULL THEN
		return 'http://api.supabase.internal:8000';
	ELSE
		return 'https://' || project_id || '.supabase.co';
	END IF;
end;
$$;

create function public.update_content()
returns trigger as $$
begin
  perform
    net.http_post(
      url := supabase_url() || '/functions/v1/update-content',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', current_setting('request.headers')::json->>'authorization'
      ),
      body := jsonb_build_object(
        'record', NEW
      )
    );
  return new;
end;
$$ language plpgsql;

create trigger send_content_update_to_edge_function
before insert on content_updates
for each row 
execute procedure public.update_content();