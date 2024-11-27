ALTER TABLE content_updates
ALTER COLUMN change DROP NOT NULL,
ADD COLUMN "data" jsonb,
ADD COLUMN "type" text;