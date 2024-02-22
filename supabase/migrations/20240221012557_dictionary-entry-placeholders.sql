CREATE TABLE dictionaries (
  id text unique primary key NOT NULL
  -- TODO: add rest of fields and migrate from Firestore, then clean up before_on_sentence_updates TRIGGER
);

ALTER TABLE dictionaries ENABLE ROW LEVEL SECURITY;

CREATE TABLE entries (
  id text unique primary key NOT NULL
  -- TODO: add rest of fields and migrate from Firestore
);

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;