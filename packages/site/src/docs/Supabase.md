# Local [Supabase](https://supabase.com/docs) dev

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

- `supabase gen types typescript --local --schema public > packages/site/src/lib/supabase/generated.types.ts`
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
