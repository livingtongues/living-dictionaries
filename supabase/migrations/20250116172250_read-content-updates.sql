CREATE POLICY "Can view content updates" 
  ON content_updates
  FOR SELECT
  USING (TRUE);