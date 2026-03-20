All tables exist in Supabase postgres in the cloud.
Relevant portions of tables are synced down to PGLite postgres on device.

Start with the tables relevant to the admin backend to get our feet wet.
- users
- dictionaries
- managers
- contributors

## Local device process

### Pull data
- When a user first comes (in this case, the first time an admin user goes to the site on a new device), init PGLite, run migrations, download relevant tables from Supabase and be ready to query the data when needed.
- Save **last_synced_at** time to local database so that database knows when it's up to date as of.
- When a user (admin) comes next time again (or when sync pushed) we check supabase for any rows that have been updated since the last_synced_at time.

### Push data
- When a change is made to a row, like editing the dictionaries' conlang attribute save in this manner:
  - load row from pglite
  - make save to pglite, if error alert user and stop
    - At this point, the UI will update immediately based on the update pglite data
  - make save to supabase, if error notify user and rollback pglite using loaded row in first step
  - all is good

What this means is that any data pushed up, will actually be pulled back down in the next sync pull, since it's updated_at date will be newer than last_sync_at. That's ok, we want to make our sync code as simple as possible.
  What that means is that PGLite schemas can be identical to supabase in every way EXCEPT 1: in Supabase, the updated_at field is always set by Supabase when data comes. In PGLite field the updated_at field is only auto-set when it doesn't exist in the write. When the write contains an updated_at field it just accepts it.
