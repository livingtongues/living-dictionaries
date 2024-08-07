ALTER TABLE entries
ALTER COLUMN notes TYPE jsonb USING notes::jsonb; -- MultiString (was text previously)

ALTER TABLE entries
ADD COLUMN elicitation_id text; -- Elicitation Id for Munda languages or Swadesh Composite number list from Comparalex, used for Onondaga custom sort
