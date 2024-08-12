ALTER TABLE audio
ADD COLUMN entry_id text REFERENCES entries,
ADD COLUMN sentence_id uuid REFERENCES sentences,
ADD COLUMN text_id uuid REFERENCES texts;
