-- Structured, entry-linked grammar + interlinear-glossing (IGT) layer.
-- Evolves the single free-text `dictionaries.grammar` blob (which lives in
-- shared.db and stays as an optional page intro) into a hierarchical,
-- parallel-language, entry-linked grammar that reuses the texts/sentences/audio
-- model. See .issues/structured-grammar.md for the full design + the corpus
-- agent's data-validation rounds.
--
-- New syncable tables:
--   clause_slots            — per-dict clause-template position vocabulary
--   glossing_abbreviations  — per-dict IGT gloss legend (3PL -> "third person plural")
--   grammar_sections        — the hierarchical section tree (self-ref parent_id)
--   section_sentences       — examples by reference (mirrors senses_in_sentences)
--   text_tags               — motif/genre/tale-type classification (mirrors entry_tags)
--
-- New columns on existing tables:
--   sentences.discourse_role — salience band / information role in narrative
--   sentences.example_label  — the author's own example number ("(2a)")
--   sentences.citations      — JSON [{slug, locator}] source loci (own column,
--                              leaves the shared `sources[]` slug path untouched)
--   sources.orthography      — which script/orthography the source's forms use
--   tags.kind / tags.code    — classify a tag as motif/genre/tale-type + its code
--
-- Every new content table carries `dirty` + `server_seq` and the standard
-- bump-lmod + server_seq triggers, and is added to `process_delete_cascade`.
-- `server_seq` is included in the CREATE TABLE (this migration post-dates the
-- 20260709 server_seq migration, so there is no backfill/ALTER for it here).

------------------------------------------------------------------
-- clause_slots (clause-template position vocabulary)
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clause_slots (
  id TEXT PRIMARY KEY,
  sort_key TEXT NOT NULL, -- fractional index (LexoRank-style); ordered list = the clause template
  name TEXT NOT NULL,     -- JSON MultiString
  code TEXT,
  dirty INTEGER,
  server_seq INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_clause_slots_sort ON clause_slots(sort_key);
CREATE INDEX IF NOT EXISTS idx_clause_slots_updated_at ON clause_slots(updated_at);
CREATE INDEX IF NOT EXISTS idx_clause_slots_server_seq ON clause_slots(server_seq);

------------------------------------------------------------------
-- glossing_abbreviations (IGT gloss legend, found-or-created by code)
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS glossing_abbreviations (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,     -- JSON MultiString
  category TEXT,
  dirty INTEGER,
  server_seq INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (code)
);
CREATE INDEX IF NOT EXISTS idx_glossing_abbreviations_updated_at ON glossing_abbreviations(updated_at);
CREATE INDEX IF NOT EXISTS idx_glossing_abbreviations_server_seq ON glossing_abbreviations(server_seq);

------------------------------------------------------------------
-- grammar_sections (hierarchical tree; self-ref parent_id safe under deferred FKs)
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grammar_sections (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES grammar_sections(id) ON DELETE CASCADE, -- NULL = top-level
  sort_key TEXT NOT NULL,          -- fractional index, ordering among siblings (same parent_id)
  number_label TEXT,               -- optional explicit "2.2.1.1"; derived when NULL
  title TEXT NOT NULL,             -- JSON MultiString (markdown)
  body TEXT,                       -- JSON MultiString (markdown)
  usage_conditions TEXT,           -- JSON MultiString (markdown)
  slot_id TEXT REFERENCES clause_slots(id) ON DELETE SET NULL,
  entry_id TEXT REFERENCES entries(id) ON DELETE SET NULL,
  sense_id TEXT REFERENCES senses(id) ON DELETE SET NULL,
  dirty INTEGER,
  server_seq INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_grammar_sections_parent ON grammar_sections(parent_id);
CREATE INDEX IF NOT EXISTS idx_grammar_sections_sort ON grammar_sections(sort_key);
CREATE INDEX IF NOT EXISTS idx_grammar_sections_entry ON grammar_sections(entry_id);
CREATE INDEX IF NOT EXISTS idx_grammar_sections_sense ON grammar_sections(sense_id);
CREATE INDEX IF NOT EXISTS idx_grammar_sections_slot ON grammar_sections(slot_id);
CREATE INDEX IF NOT EXISTS idx_grammar_sections_updated_at ON grammar_sections(updated_at);
CREATE INDEX IF NOT EXISTS idx_grammar_sections_server_seq ON grammar_sections(server_seq);

------------------------------------------------------------------
-- section_sentences (examples by reference; junction, mirrors senses_in_sentences)
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS section_sentences (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES grammar_sections(id) ON DELETE CASCADE,
  sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
  sort_key TEXT, -- fractional index ordering examples within a section
  dirty INTEGER,
  server_seq INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (section_id, sentence_id)
);
CREATE INDEX IF NOT EXISTS idx_section_sentences_sentence ON section_sentences(sentence_id);
CREATE INDEX IF NOT EXISTS idx_section_sentences_sort ON section_sentences(sort_key);
CREATE INDEX IF NOT EXISTS idx_section_sentences_updated_at ON section_sentences(updated_at);
CREATE INDEX IF NOT EXISTS idx_section_sentences_server_seq ON section_sentences(server_seq);

------------------------------------------------------------------
-- text_tags (motif/genre/tale-type classification; junction, mirrors entry_tags)
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS text_tags (
  id TEXT PRIMARY KEY,
  text_id TEXT NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  dirty INTEGER,
  server_seq INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (text_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_text_tags_tag ON text_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_text_tags_updated_at ON text_tags(updated_at);
CREATE INDEX IF NOT EXISTS idx_text_tags_server_seq ON text_tags(server_seq);

------------------------------------------------------------------
-- New columns on existing tables (plain ADD COLUMN; JSON cols are TEXT at rest)
------------------------------------------------------------------
ALTER TABLE sentences ADD COLUMN discourse_role TEXT;
ALTER TABLE sentences ADD COLUMN example_label TEXT;
ALTER TABLE sentences ADD COLUMN citations TEXT; -- JSON SourceCitation[]
ALTER TABLE sources ADD COLUMN orthography TEXT;
ALTER TABLE tags ADD COLUMN kind TEXT;
ALTER TABLE tags ADD COLUMN code TEXT;

------------------------------------------------------------------
-- Sync-cursor bump triggers (db_metadata.last_modified_at), one INSERT + one
-- UPDATE per new syncable table.
------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS clause_slots_after_insert_bump_lmod
AFTER INSERT ON clause_slots BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS clause_slots_after_update_bump_lmod
AFTER UPDATE ON clause_slots BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

CREATE TRIGGER IF NOT EXISTS glossing_abbreviations_after_insert_bump_lmod
AFTER INSERT ON glossing_abbreviations BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS glossing_abbreviations_after_update_bump_lmod
AFTER UPDATE ON glossing_abbreviations BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

CREATE TRIGGER IF NOT EXISTS grammar_sections_after_insert_bump_lmod
AFTER INSERT ON grammar_sections BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS grammar_sections_after_update_bump_lmod
AFTER UPDATE ON grammar_sections BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

CREATE TRIGGER IF NOT EXISTS section_sentences_after_insert_bump_lmod
AFTER INSERT ON section_sentences BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS section_sentences_after_update_bump_lmod
AFTER UPDATE ON section_sentences BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

CREATE TRIGGER IF NOT EXISTS text_tags_after_insert_bump_lmod
AFTER INSERT ON text_tags BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS text_tags_after_update_bump_lmod
AFTER UPDATE ON text_tags BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

------------------------------------------------------------------
-- server_seq triggers (strictly-monotonic per-DB sync cursor), one INSERT + one
-- guarded UPDATE per new syncable table (mirrors the 20260709 migration).
------------------------------------------------------------------
DROP TRIGGER IF EXISTS clause_slots_server_seq_ai;
CREATE TRIGGER clause_slots_server_seq_ai AFTER INSERT ON clause_slots
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE clause_slots SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;
DROP TRIGGER IF EXISTS clause_slots_server_seq_au;
CREATE TRIGGER clause_slots_server_seq_au AFTER UPDATE ON clause_slots
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE clause_slots SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS glossing_abbreviations_server_seq_ai;
CREATE TRIGGER glossing_abbreviations_server_seq_ai AFTER INSERT ON glossing_abbreviations
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE glossing_abbreviations SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;
DROP TRIGGER IF EXISTS glossing_abbreviations_server_seq_au;
CREATE TRIGGER glossing_abbreviations_server_seq_au AFTER UPDATE ON glossing_abbreviations
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE glossing_abbreviations SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS grammar_sections_server_seq_ai;
CREATE TRIGGER grammar_sections_server_seq_ai AFTER INSERT ON grammar_sections
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE grammar_sections SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;
DROP TRIGGER IF EXISTS grammar_sections_server_seq_au;
CREATE TRIGGER grammar_sections_server_seq_au AFTER UPDATE ON grammar_sections
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE grammar_sections SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS section_sentences_server_seq_ai;
CREATE TRIGGER section_sentences_server_seq_ai AFTER INSERT ON section_sentences
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE section_sentences SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;
DROP TRIGGER IF EXISTS section_sentences_server_seq_au;
CREATE TRIGGER section_sentences_server_seq_au AFTER UPDATE ON section_sentences
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE section_sentences SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS text_tags_server_seq_ai;
CREATE TRIGGER text_tags_server_seq_ai AFTER INSERT ON text_tags
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE text_tags SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;
DROP TRIGGER IF EXISTS text_tags_server_seq_au;
CREATE TRIGGER text_tags_server_seq_au AFTER UPDATE ON text_tags
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE text_tags SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- Re-declare the hard-delete cascade with the 5 new tables included (DROP +
-- CREATE so every DB converges on the same trigger body).
------------------------------------------------------------------
DROP TRIGGER IF EXISTS process_delete_cascade;
CREATE TRIGGER process_delete_cascade AFTER INSERT ON deletes
BEGIN
  DELETE FROM entries                WHERE id = NEW.id AND NEW.table_name = 'entries';
  DELETE FROM texts                  WHERE id = NEW.id AND NEW.table_name = 'texts';
  DELETE FROM senses                 WHERE id = NEW.id AND NEW.table_name = 'senses';
  DELETE FROM sentences              WHERE id = NEW.id AND NEW.table_name = 'sentences';
  DELETE FROM senses_in_sentences    WHERE id = NEW.id AND NEW.table_name = 'senses_in_sentences';
  DELETE FROM speakers               WHERE id = NEW.id AND NEW.table_name = 'speakers';
  DELETE FROM audio                  WHERE id = NEW.id AND NEW.table_name = 'audio';
  DELETE FROM audio_speakers         WHERE id = NEW.id AND NEW.table_name = 'audio_speakers';
  DELETE FROM videos                 WHERE id = NEW.id AND NEW.table_name = 'videos';
  DELETE FROM video_speakers         WHERE id = NEW.id AND NEW.table_name = 'video_speakers';
  DELETE FROM sense_videos           WHERE id = NEW.id AND NEW.table_name = 'sense_videos';
  DELETE FROM sentence_videos        WHERE id = NEW.id AND NEW.table_name = 'sentence_videos';
  DELETE FROM photos                 WHERE id = NEW.id AND NEW.table_name = 'photos';
  DELETE FROM sense_photos           WHERE id = NEW.id AND NEW.table_name = 'sense_photos';
  DELETE FROM sentence_photos        WHERE id = NEW.id AND NEW.table_name = 'sentence_photos';
  DELETE FROM dialects               WHERE id = NEW.id AND NEW.table_name = 'dialects';
  DELETE FROM entry_dialects         WHERE id = NEW.id AND NEW.table_name = 'entry_dialects';
  DELETE FROM tags                   WHERE id = NEW.id AND NEW.table_name = 'tags';
  DELETE FROM entry_tags             WHERE id = NEW.id AND NEW.table_name = 'entry_tags';
  DELETE FROM sources                WHERE id = NEW.id AND NEW.table_name = 'sources';
  DELETE FROM relationship_types     WHERE id = NEW.id AND NEW.table_name = 'relationship_types';
  DELETE FROM entry_relationships    WHERE id = NEW.id AND NEW.table_name = 'entry_relationships';
  DELETE FROM featured_entries       WHERE id = NEW.id AND NEW.table_name = 'featured_entries';
  DELETE FROM clause_slots           WHERE id = NEW.id AND NEW.table_name = 'clause_slots';
  DELETE FROM glossing_abbreviations WHERE id = NEW.id AND NEW.table_name = 'glossing_abbreviations';
  DELETE FROM grammar_sections       WHERE id = NEW.id AND NEW.table_name = 'grammar_sections';
  DELETE FROM section_sentences      WHERE id = NEW.id AND NEW.table_name = 'section_sentences';
  DELETE FROM text_tags              WHERE id = NEW.id AND NEW.table_name = 'text_tags';
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
