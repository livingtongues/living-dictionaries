DECLARE
    row_exists BOOLEAN;
BEGIN
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE id = %L)', NEW.table, NEW.row)
  INTO row_exists;

  IF row_exists THEN
    --
  ELSE
    --
  END IF;
END;