# Local [Supabase](https://supabase.com/docs) dev

Schema:
https://drawsql.app/teams/ld-4/diagrams/entries-sentences-texts
https://supabase.com/dashboard/project/actkqboqpzniojhgtqzw/database/schemas
http://127.0.0.1:54323/project/default/database/schemas

Handle speakers id being uuid and lots of connections with FB speaker ids not matching, 20240222001122_media-tables.sql

## Setup
1. [Install supabase cli locally](https://supabase.com/docs/guides/cli) *- you can skip this the first few times and just prepend `pnpx ` to the commands below, but after awhile you will tire of waiting for pnpx on each command*
2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and make sure it is running

## Development

- `supabase start` to start a local instance of supabase, including POSTGres, Storage, Email, Functions, etc...
- `supabase migration new <feature-name>` to write a new sql migration that will edit the database. Changes are saved in version control under supabase/migrations.
- `supabase migration up` to apply pending migrations to local database (prefer running `supabase db reset` instead)
- `supabase db reset` to wipe the database, run each migration sequentially and then finally the `seed.sql` file.
- `supabase stop` to close down the Docker containers. State will be saved and restored the next time you run `supabase start`

Once you have run `supabase start` you can open the Studio URL to explore your local Supabase project. The studio is a convenient way to inspect data and make changes via a UI, but after making changes use the UI to see the underlying SQL changes and then create a new migration with the SQL. Then run `supabase db reset` to make sure your migration works as expected.

## Generate Types

Local:
- Run `pnpm generate-types` which will do `supabase gen types typescript --local --schema public > packages/types/supabase/generated.types.ts` and lint and take your `augments.types.ts` to output a `combined.types.ts` with type information for all the `jsonb` fields.

Deployed (we don't use this):
- `supabase gen types typescript --project-id=actkqboqpzniojhgtqzw --schema public > packages/site/src/lib/supabase/generated.types.ts`

## Tests

See [pgTAP docs](https://pgtap.org/documentation.html) and https://supabase.com/docs/guides/database/extensions/pgtap

- `supabase test new <name>` to create a new test file
- `supabase test db` to run tests

## Push config changes and new migrations to cloud project
You can check current prod migrations at https://supabase.com/dashboard/project/actkqboqpzniojhgtqzw/database/migrations

- `supabase login`
- `supabase link --project-ref=actkqboqpzniojhgtqzw --password=<DB password>`
- `supabase db push`

## Misc

- `supabase status` check status and get local urls

## Use data from a `pg_dump` backup locally

These four commands are run daily to backup the production database:
- `supabase db dump --db-url "$supabase_db_url" -f roles.sql --role-only`
- `supabase db dump --db-url "$supabase_db_url" -f schema.sql`
- `supabase db dump --db-url "$supabase_db_url" -f data-copy.sql --data-only --use-copy`
- `supabase db dump --db-url "$supabase_db_url" -f data-insert.sql --data-only`

To make the local DB match the current production download just download the data as the schema already matches production (or is a step ahead):
- Get the DB url by pasting the password into here: postgresql://postgres.actkqboqpzniojhgtqzw:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
- Run `supabase db dump --db-url "your-db-url" -f supabase/seed.sql --data-only` but using the db url above
- Remove the `is_anonymous` column in auth.users and find-replace `, false),` for `),` (and don't forget the last row with a semi-colon) because `is_anonymous` doesn't exist in local db. Remove the audit_log block if using a reset sql script instead of fully resetting the db.
- Run `supabase db reset` to build the db with the production data

## Other `pg_dump` notes that did not pan out but may be useful in other situations

- Read how to migrate a project: https://supabase.com/docs/guides/platform/migrating-and-upgrading-projects#migrate-your-project
- The dump file produced by pg_dump does not contain the statistics used by the optimizer to make query planning decisions. Therefore, it is wise to run ANALYZE after restoring from a dump file to ensure good performance. (source: https://www.postgresql.org/docs/8.0/app-pgdump.html) `psql -d 'postgres://supabase_admin:postgres@127.0.0.1:54322/postgres' -c 'ANALYZE;'`
- comment out `COPY "auth"."flow_state"...` block
- reset db with no migrations

psql \
  --single-transaction \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

Other options
  --variable ON_ERROR_STOP=1 \ - not using because of syntax errors

- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f live-db-dump.sql`
- `psql -d database -f data.sql` to restore the data from a dump file obtained from Supabase's automatic backup. -d database: Specifies the name of the database to connect to.
