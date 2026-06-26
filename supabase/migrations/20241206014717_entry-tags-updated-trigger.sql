CREATE TRIGGER update_entry_updated_at_entry_tags
AFTER INSERT OR UPDATE ON entry_tags
FOR EACH ROW
EXECUTE FUNCTION update_entry_updated_at();