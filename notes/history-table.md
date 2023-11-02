I want a table of dictionary entries, and then on entry change, I want to run a trigger to take the old entry and save it for users to be able to read a change history. Should I keep these old entries in the same table with a separate field like "changed" and a date so they don't get loaded with current entries. Or should I put them in a separate history table? When the main table shape changes I want these entries shape to change also so it seems like running migrations on both tables is a bit tedious. What is your advice?
You can use a separate history table to store the old entries. This way, you can keep your main table clean and avoid loading it with old entries. You can create a trigger on the main table to insert the old entry into the history table whenever a change is made.

Here's an example of how you can create a history table and a trigger to insert old entries into it:

```sql
-- Create the main table
CREATE TABLE dictionary_entries (
  id SERIAL PRIMARY KEY,
  word TEXT NOT NULL,
  definition TEXT NOT NULL
);

-- Create the history table
CREATE TABLE dictionary_entry_history (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER NOT NULL,
  word TEXT NOT NULL,
  definition TEXT NOT NULL,
  changed TIMESTAMP NOT NULL
);

-- Create the trigger
CREATE OR REPLACE FUNCTION dictionary_entry_history_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO dictionary_entry_history (entry_id, word, definition, changed)
    VALUES (OLD.id, OLD.word, OLD.definition, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dictionary_entry_history
AFTER UPDATE ON dictionary_entries
FOR EACH ROW
EXECUTE FUNCTION dictionary_entry_history_trigger();
```

With this setup, whenever a row in the dictionary_entries table is updated, the trigger will insert the old entry into the dictionary_entry_history table with a timestamp. You can then query the dictionary_entry_history table to get the change history for a particular entry.

Regarding your concern about running migrations on both tables, you can use a tool like Knex.js to manage your database schema and migrations. Knex.js supports creating multiple tables in a single migration file, so you can update both the main table and the history table in a single migration.

---------

How would I do the migration with knex?

To create a migration with Knex.js, you can use the knex migrate:make command. This will create a new migration file in the migrations directory. Here's an example migration file that creates the dictionary_entries table and the dictionary_entry_history table:

```js
exports.up = function(knex) {
  return knex.schema
    .createTable('dictionary_entries', function(table) {
      table.increments('id').primary();
      table.string('word').notNullable();
      table.string('definition').notNullable();
    })
    .createTable('dictionary_entry_history', function(table) {
      table.increments('id').primary();
      table.integer('entry_id').notNullable();
      table.string('word').notNullable();
      table.string('definition').notNullable();
      table.timestamp('changed').notNullable();
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('dictionary_entry_history')
    .dropTable('dictionary_entries');
};
```

The up function defines the changes to be made to the database schema, while the down function defines how to undo those changes. In this example, the up function creates the dictionary_entries and dictionary_entry_history tables, while the down function drops those tables.

To run the migration, you can use the knex migrate:latest command. This will apply all pending migrations to the database. If you need to rollback the migration, you can use the knex migrate:rollback command.

Once you have created the migration file, you can modify it to add or remove columns from the tables, and then run the migration again to apply the changes to the database schema.

I hope this helps! Let me know if you have any other questions.