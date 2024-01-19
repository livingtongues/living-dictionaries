CREATE TABLE imports (
  id uuid primary key default uuid_generate_v4(),
  created_by uuid references auth.users not null,
  dictionary_id text NOT NULL, -- would reference dictionaries table
  entry_id text NOT NULL, -- would reference entries table
  created_at timestamp with time zone DEFAULT now(),
  -- value jsonb not null, -- if you dump data here, it gives us a record, we can have a supabase function (deno/node) triggered that will then process the data and create rows in appropriate tables throughout database.
);

ALTER TABLE imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY imports_manager_policy
ON imports
USING (is_manager(current_setting('auth.uid')::uuid, dictionary_id))
FOR SELECT
USING (is_manager(current_setting('auth.uid')::uuid, dictionary_id));

-- create a read policy whereby if a user was a manager for the dicionary_id then they can have access to look any import data that may exist for that entry