CREATE TYPE entry_relationships AS ENUM ('singular_plural', 'variant'); -- 'antonym', 'synonym'

CREATE TABLE entry_entry (
  entry1_id text NOT NULL REFERENCES entries,
  entry2_id text NOT NULL REFERENCES entries,
  nature_of_relationship entry_relationships NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone,
  PRIMARY KEY (entry1_id, entry2_id)
);

-- color (American) colour (British) (spelling variant)
-- aluminium, aluminium (2 audio files) (speaking variant)
