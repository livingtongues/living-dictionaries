CREATE FUNCTION apply_entry_updates()
RETURNS TRIGGER AS $$
DECLARE
    row_exists BOOLEAN;
BEGIN
    -- Check if the row exists in the specified table for the given ID
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE id = %L)', NEW.table, NEW.row)
  INTO row_exists;

  IF row_exists THEN
    EXECUTE format('UPDATE %I SET %I = %L, updated_at = now() WHERE id = %L', NEW.table, NEW.column, NEW.new_value, NEW.row);
  ELSE
    EXECUTE format('INSERT INTO %I (id, entry_id, created_at, created_by, updated_at, updated_by, %I) VALUES (%L, %L, now(), %L, now(), %L, %L)', NEW.table, NEW.column, NEW.row, NEW.entry_id, NEW.dictionary_id, NEW.dictionary_id, NEW.new_value);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;