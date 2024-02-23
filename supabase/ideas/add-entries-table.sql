-- connect senses to entries

ALTER TABLE senses
ADD CONSTRAINT foreign_key_entries
FOREIGN KEY (entry_id) REFERENCES entries(id);

-- migrate entries from Firestore to PostGRES
