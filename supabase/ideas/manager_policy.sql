CREATE POLICY manager_policy
ON imports
USING (is_manager(current_setting('auth.uid')::uuid, dictionary_id))
FOR SELECT
USING (is_manager(current_setting('auth.uid')::uuid, dictionary_id));
