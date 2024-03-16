# Supabase and PostGRES learning

## Views RLS

Read more at https://www.reddit.com/r/Supabase/comments/txq9o9/rls_views_and_functions/

??

```sql
CREATE ROLE viewers;
GRANT SELECT ON entries_view TO viewers;
CREATE POLICY senses_viewers_policy
  ON senses
  FOR ALL
  TO viewers
  USING (true);
CREATE POLICY "Anyone can see the entries view"
  ON entries_view FOR SELECT
  USING ( true );
```

## Find column data types

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'senses' AND column_name = 'glosses';
```

## Store data as History not State

We don't do everything the same, but these links have good information to learn from regarding storing data as history instead of state and offline first apps.

Read: https://dev.to/mistval/database-architecture-history-over-state-3m8o
Watch https://www.youtube.com/watch?v=DEcwa68f-jY and try out at https://github.com/jlongster/crdt-example-app

## Loop over column names

```sql
declare
  column_name text;
begin
  for column_name in
    select column_name
    from information_schema.columns
    where table_name = 'entries'
  loop
    execute format('...', column_name);
  end loop;

  return new;
end;
```
