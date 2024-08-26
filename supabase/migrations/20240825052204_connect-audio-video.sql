ALTER TABLE audio
ADD COLUMN entry_id text REFERENCES entries,
ADD COLUMN sentence_id uuid REFERENCES sentences,
ADD COLUMN text_id uuid REFERENCES texts;

ALTER TABLE videos
ALTER COLUMN storage_path DROP NOT NULL,
ADD COLUMN hosted_elsewhere jsonb, -- Hosted elsewhere (e.g. YouTube, Vimeo, etc.)
ADD COLUMN text_id uuid REFERENCES texts;