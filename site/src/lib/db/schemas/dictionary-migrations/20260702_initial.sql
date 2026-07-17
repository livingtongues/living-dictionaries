-- Consolidated initial migration for `dictionaries/{id}.db`
-- (pre-cutover squash of the 2026-06-06 → 2026-07-02 chain, 2026-07-02). Runs on:
--   1. The server's per-dict better-sqlite3 file (via `get_dictionary_db()`)
--   2. The R2 snapshot pipeline (snapshot is built FROM the server's file, so
--      this migration's tables are what viewers pull down)
--   3. Every client's wa-sqlite OPFS instance (via the leader worker)
--
-- IDEMPOTENT BY DESIGN: every statement is a no-op on an already-migrated DB
-- (IF NOT EXISTS / DROP-then-CREATE for the cascade trigger). Migration runners
-- apply by NAME, so this file re-runs over every DB provisioned from the
-- pre-squash chain and converges it (including the index tuning at the bottom)
-- while self-recording in `migrations`.
--
-- Conventions (per port-db-sync-architecture.md):
--   - Deletion is HARD: INSERT INTO deletes(table_name, id) fires
--     `process_delete_cascade` which DELETEs the row; FK ON DELETE CASCADE
--     sweeps children. There is NO `deleted` column — purged rows are gone.
--   - Every content table has `dirty INTEGER` (NULL/0 = clean, 1 = pending push).
--   - Every junction table has synthetic UUID PK + UNIQUE on natural key. The
--     UNIQUE's leading column doubles as that column's lookup / FK-cascade
--     index, so no separate single-column index is created for it.
--   - `last_modified_at` triggers fan out on every syncable table (+ on the
--     `deletes` tombstone, so a delete advances the sync cursor too).

CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  run_on TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS db_metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Tombstones — INSERT INTO deletes(table_name, id) fires the
-- `process_delete_cascade` trigger, which HARD-DELETEs the matching row.
-- The tombstone row persists as the durable delete log: the server forwards it
-- to peers (pull `WHERE updated_at > cursor`); the client uses it as the push
-- queue (drained after push). Snapshots are stripped of these rows at build.
-- Both the pull and the snapshot-builder prune filter on bare `updated_at`
-- (no table_name), hence the single-column index.
CREATE TABLE IF NOT EXISTS deletes (
  table_name TEXT NOT NULL,
  id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (table_name, id)
);
CREATE INDEX IF NOT EXISTS idx_deletes_updated_at ON deletes(updated_at);

------------------------------------------------------------------
-- Content tables
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  lexeme TEXT NOT NULL, -- JSON MultiString
  phonetic TEXT,
  interlinearization TEXT,
  morphology TEXT,
  notes TEXT, -- JSON MultiString
  linguistic_history TEXT, -- JSON MultiString
  sources TEXT, -- JSON string[] of sources.slug refs
  scientific_names TEXT, -- JSON string[]
  coordinates TEXT, -- JSON
  unsupported_fields TEXT, -- JSON
  elicitation_id TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at);
-- /api/v1 supports an exact elicitation_id filter (agent import/dedup workflows).
CREATE INDEX IF NOT EXISTS idx_entries_elicitation ON entries(elicitation_id) WHERE elicitation_id IS NOT NULL;

-- A per-dictionary long-text / story object. Order + paragraph breaks live on
-- the child sentences (sentences.sort_key + sentences.ends_paragraph), not on
-- the text. Sentences, audio, and videos back-reference a text via `text_id`.
CREATE TABLE IF NOT EXISTS texts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL, -- JSON MultiString
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  sources TEXT -- JSON string[] of sources.slug refs (column position: appended post-initial on pre-squash DBs)
);
CREATE INDEX IF NOT EXISTS idx_texts_updated_at ON texts(updated_at);

CREATE TABLE IF NOT EXISTS senses (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  definition TEXT,
  glosses TEXT,
  parts_of_speech TEXT,
  semantic_domains TEXT,
  write_in_semantic_domains TEXT,
  noun_class TEXT,
  plural_form TEXT,
  variant TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_senses_entry ON senses(entry_id);
CREATE INDEX IF NOT EXISTS idx_senses_updated_at ON senses(updated_at);

CREATE TABLE IF NOT EXISTS sentences (
  id TEXT PRIMARY KEY,
  text TEXT,
  translation TEXT,
  text_id TEXT REFERENCES texts(id) ON DELETE SET NULL,
  sort_key TEXT, -- fractional index (LexoRank-style) ordering within text_id; NULL for standalone example sentences
  ends_paragraph INTEGER, -- 1 = a paragraph break follows this sentence
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  sources TEXT -- JSON string[] of sources.slug refs (column position: appended post-initial on pre-squash DBs)
);
CREATE INDEX IF NOT EXISTS idx_sentences_updated_at ON sentences(updated_at);
-- Composite (text_id, sort_key) serves both the text filter and the ORDER BY sort_key read.
CREATE INDEX IF NOT EXISTS idx_sentences_text_sort ON sentences(text_id, sort_key) WHERE text_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS senses_in_sentences (
  id TEXT PRIMARY KEY,
  sense_id TEXT NOT NULL REFERENCES senses(id) ON DELETE CASCADE,
  sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (sense_id, sentence_id)
);
CREATE INDEX IF NOT EXISTS idx_senses_in_sentences_sentence ON senses_in_sentences(sentence_id);
CREATE INDEX IF NOT EXISTS idx_senses_in_sentences_updated_at ON senses_in_sentences(updated_at);

CREATE TABLE IF NOT EXISTS speakers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  decade INTEGER,
  gender TEXT, -- 'm' | 'f' | 'o'
  birthplace TEXT,
  user_id TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_speakers_updated_at ON speakers(updated_at);

CREATE TABLE IF NOT EXISTS audio (
  id TEXT PRIMARY KEY,
  entry_id TEXT REFERENCES entries(id) ON DELETE CASCADE,
  sentence_id TEXT REFERENCES sentences(id) ON DELETE CASCADE,
  text_id TEXT REFERENCES texts(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  source TEXT, -- a sources.slug registry ref (validated on write, NULLed on source delete)
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_audio_entry ON audio(entry_id);
CREATE INDEX IF NOT EXISTS idx_audio_sentence ON audio(sentence_id);
CREATE INDEX IF NOT EXISTS idx_audio_text ON audio(text_id) WHERE text_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audio_updated_at ON audio(updated_at);

CREATE TABLE IF NOT EXISTS audio_speakers (
  id TEXT PRIMARY KEY,
  audio_id TEXT NOT NULL REFERENCES audio(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (audio_id, speaker_id)
);
CREATE INDEX IF NOT EXISTS idx_audio_speakers_speaker ON audio_speakers(speaker_id);
CREATE INDEX IF NOT EXISTS idx_audio_speakers_updated_at ON audio_speakers(updated_at);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  storage_path TEXT,
  hosted_elsewhere TEXT, -- JSON HostedElsewhere
  source TEXT, -- a sources.slug registry ref (validated on write, NULLed on source delete)
  videographer TEXT,
  text_id TEXT REFERENCES texts(id) ON DELETE CASCADE,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_videos_text ON videos(text_id) WHERE text_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_updated_at ON videos(updated_at);

CREATE TABLE IF NOT EXISTS video_speakers (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (video_id, speaker_id)
);
CREATE INDEX IF NOT EXISTS idx_video_speakers_speaker ON video_speakers(speaker_id);
CREATE INDEX IF NOT EXISTS idx_video_speakers_updated_at ON video_speakers(updated_at);

CREATE TABLE IF NOT EXISTS sense_videos (
  id TEXT PRIMARY KEY,
  sense_id TEXT NOT NULL REFERENCES senses(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (sense_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_sense_videos_video ON sense_videos(video_id);
CREATE INDEX IF NOT EXISTS idx_sense_videos_updated_at ON sense_videos(updated_at);

CREATE TABLE IF NOT EXISTS sentence_videos (
  id TEXT PRIMARY KEY,
  sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (sentence_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_sentence_videos_video ON sentence_videos(video_id);
CREATE INDEX IF NOT EXISTS idx_sentence_videos_updated_at ON sentence_videos(updated_at);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  storage_path TEXT NOT NULL,
  serving_url TEXT NOT NULL,
  source TEXT, -- free-text caption/attribution prose (NOT a registry ref, unlike audio/videos.source)
  photographer TEXT,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_photos_updated_at ON photos(updated_at);

CREATE TABLE IF NOT EXISTS sense_photos (
  id TEXT PRIMARY KEY,
  sense_id TEXT NOT NULL REFERENCES senses(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (sense_id, photo_id)
);
CREATE INDEX IF NOT EXISTS idx_sense_photos_photo ON sense_photos(photo_id);
CREATE INDEX IF NOT EXISTS idx_sense_photos_updated_at ON sense_photos(updated_at);

CREATE TABLE IF NOT EXISTS sentence_photos (
  id TEXT PRIMARY KEY,
  sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (sentence_id, photo_id)
);
CREATE INDEX IF NOT EXISTS idx_sentence_photos_photo ON sentence_photos(photo_id);
CREATE INDEX IF NOT EXISTS idx_sentence_photos_updated_at ON sentence_photos(updated_at);

CREATE TABLE IF NOT EXISTS dialects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, -- JSON MultiString
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_dialects_updated_at ON dialects(updated_at);

CREATE TABLE IF NOT EXISTS entry_dialects (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  dialect_id TEXT NOT NULL REFERENCES dialects(id) ON DELETE CASCADE,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (entry_id, dialect_id)
);
CREATE INDEX IF NOT EXISTS idx_entry_dialects_dialect ON entry_dialects(dialect_id);
CREATE INDEX IF NOT EXISTS idx_entry_dialects_updated_at ON entry_dialects(updated_at);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  private INTEGER,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_tags_updated_at ON tags(updated_at);

CREATE TABLE IF NOT EXISTS entry_tags (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (entry_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_entry_tags_updated_at ON entry_tags(updated_at);

-- Structured sources: per-dict citation registry. Entries/sentences/texts (and
-- entry_relationships) reference rows here via JSON slug-array columns — no FK;
-- writes validate the slug exists and source deletion is refused while
-- referenced. See .issues/sources-model.md.
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  citation TEXT,
  abbreviation TEXT,
  author TEXT,
  year TEXT, -- TEXT (not INTEGER) to allow ranges like "1979–1985"
  url TEXT,
  license TEXT,
  type TEXT, -- one of SOURCE_TYPES in constants.ts
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_slug ON sources(slug);
CREATE INDEX IF NOT EXISTS idx_sources_updated_at ON sources(updated_at);

-- Per-dictionary registry of CUSTOM relationship types (found-or-created, like
-- tags). Global types live in constants.ts RELATIONSHIP_TYPES and are
-- referenced by slug via entry_relationships.type.
CREATE TABLE IF NOT EXISTS relationship_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,        -- JSON MultiString
  inverse_name TEXT,         -- JSON MultiString (directed custom types)
  symmetric INTEGER,         -- 1 = symmetric; NULL/0 = directed
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Typed entry-to-entry (optionally sense-to-sense) relationships, intra-dict.
-- ONE polymorphic table: from_entry_id/to_entry_id required; from_sense_id/
-- to_sense_id optional (NULL = whole-entry link, set = narrowed to a meaning).
-- `type` holds a global slug XOR `custom_type_id` references a per-dict
-- `relationship_types` row. See .issues/entry-relationships.md.
CREATE TABLE IF NOT EXISTS entry_relationships (
  id TEXT PRIMARY KEY,
  from_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  from_sense_id TEXT REFERENCES senses(id) ON DELETE CASCADE,
  to_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  to_sense_id TEXT REFERENCES senses(id) ON DELETE CASCADE,
  type TEXT,                 -- global relationship-type slug
  custom_type_id TEXT REFERENCES relationship_types(id) ON DELETE CASCADE,
  note TEXT,                 -- JSON MultiString
  sources TEXT,              -- JSON string[] of source slugs
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((type IS NOT NULL) + (custom_type_id IS NOT NULL) = 1)
);

-- Dedupe natural key. NULLs are distinct in a plain UNIQUE, so COALESCE the
-- nullable columns to '' so entry-level (NULL-sense) duplicates collide too.
-- The leading plain from_entry_id column also serves from-side lookups + FK
-- cascade scans (verified via EXPLAIN QUERY PLAN — no separate index needed).
CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_relationships_natural
  ON entry_relationships(
    from_entry_id, COALESCE(from_sense_id, ''), to_entry_id, COALESCE(to_sense_id, ''),
    COALESCE(type, ''), COALESCE(custom_type_id, ''));
CREATE INDEX IF NOT EXISTS idx_entry_relationships_to ON entry_relationships(to_entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_relationships_updated_at ON entry_relationships(updated_at);
-- FK-cascade lookups (sense / custom-type deletes) — partial: most rows are
-- whole-entry links with NULL sense refs and a global (non-custom) type.
CREATE INDEX IF NOT EXISTS idx_entry_relationships_from_sense ON entry_relationships(from_sense_id) WHERE from_sense_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entry_relationships_to_sense ON entry_relationships(to_sense_id) WHERE to_sense_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entry_relationships_custom_type ON entry_relationships(custom_type_id) WHERE custom_type_id IS NOT NULL;

------------------------------------------------------------------
-- Triggers
------------------------------------------------------------------

-- `last_modified_at` is the sync cursor. Every content-table write bumps it.
-- Hand-written per Q-shared.2 — explicit + greppable; when adding a new
-- syncable table in a future migration, the table + its trigger live in the
-- same SQL file so there's one place to look.

-- One AFTER INSERT + one AFTER UPDATE bump trigger per syncable table (SQLite
-- has no multi-event "OR" trigger syntax). DELETE doesn't need a per-table
-- trigger — `process_delete_cascade` bumps `last_modified_at` once instead.
--
-- The bump uses `INSERT ... ON CONFLICT(key) DO UPDATE`, NOT `INSERT OR REPLACE`:
-- the sync engine writes rows via an outer UPSERT, and an `OR REPLACE` inside a
-- trigger firing during that UPSERT throws `UNIQUE constraint failed:
-- db_metadata.key`. `ON CONFLICT DO UPDATE` composes cleanly with the outer upsert.

-- entries
CREATE TRIGGER IF NOT EXISTS entries_after_insert_bump_lmod
AFTER INSERT ON entries BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS entries_after_update_bump_lmod
AFTER UPDATE ON entries BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- texts
CREATE TRIGGER IF NOT EXISTS texts_after_insert_bump_lmod
AFTER INSERT ON texts BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS texts_after_update_bump_lmod
AFTER UPDATE ON texts BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- senses
CREATE TRIGGER IF NOT EXISTS senses_after_insert_bump_lmod
AFTER INSERT ON senses BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS senses_after_update_bump_lmod
AFTER UPDATE ON senses BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- sentences
CREATE TRIGGER IF NOT EXISTS sentences_after_insert_bump_lmod
AFTER INSERT ON sentences BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS sentences_after_update_bump_lmod
AFTER UPDATE ON sentences BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- senses_in_sentences
CREATE TRIGGER IF NOT EXISTS senses_in_sentences_after_insert_bump_lmod
AFTER INSERT ON senses_in_sentences BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS senses_in_sentences_after_update_bump_lmod
AFTER UPDATE ON senses_in_sentences BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- speakers
CREATE TRIGGER IF NOT EXISTS speakers_after_insert_bump_lmod
AFTER INSERT ON speakers BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS speakers_after_update_bump_lmod
AFTER UPDATE ON speakers BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- audio
CREATE TRIGGER IF NOT EXISTS audio_after_insert_bump_lmod
AFTER INSERT ON audio BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS audio_after_update_bump_lmod
AFTER UPDATE ON audio BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- audio_speakers
CREATE TRIGGER IF NOT EXISTS audio_speakers_after_insert_bump_lmod
AFTER INSERT ON audio_speakers BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS audio_speakers_after_update_bump_lmod
AFTER UPDATE ON audio_speakers BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- videos
CREATE TRIGGER IF NOT EXISTS videos_after_insert_bump_lmod
AFTER INSERT ON videos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS videos_after_update_bump_lmod
AFTER UPDATE ON videos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- video_speakers
CREATE TRIGGER IF NOT EXISTS video_speakers_after_insert_bump_lmod
AFTER INSERT ON video_speakers BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS video_speakers_after_update_bump_lmod
AFTER UPDATE ON video_speakers BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- sense_videos
CREATE TRIGGER IF NOT EXISTS sense_videos_after_insert_bump_lmod
AFTER INSERT ON sense_videos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS sense_videos_after_update_bump_lmod
AFTER UPDATE ON sense_videos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- sentence_videos
CREATE TRIGGER IF NOT EXISTS sentence_videos_after_insert_bump_lmod
AFTER INSERT ON sentence_videos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS sentence_videos_after_update_bump_lmod
AFTER UPDATE ON sentence_videos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- photos
CREATE TRIGGER IF NOT EXISTS photos_after_insert_bump_lmod
AFTER INSERT ON photos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS photos_after_update_bump_lmod
AFTER UPDATE ON photos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- sense_photos
CREATE TRIGGER IF NOT EXISTS sense_photos_after_insert_bump_lmod
AFTER INSERT ON sense_photos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS sense_photos_after_update_bump_lmod
AFTER UPDATE ON sense_photos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- sentence_photos
CREATE TRIGGER IF NOT EXISTS sentence_photos_after_insert_bump_lmod
AFTER INSERT ON sentence_photos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS sentence_photos_after_update_bump_lmod
AFTER UPDATE ON sentence_photos BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- dialects
CREATE TRIGGER IF NOT EXISTS dialects_after_insert_bump_lmod
AFTER INSERT ON dialects BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS dialects_after_update_bump_lmod
AFTER UPDATE ON dialects BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- entry_dialects
CREATE TRIGGER IF NOT EXISTS entry_dialects_after_insert_bump_lmod
AFTER INSERT ON entry_dialects BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS entry_dialects_after_update_bump_lmod
AFTER UPDATE ON entry_dialects BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- tags
CREATE TRIGGER IF NOT EXISTS tags_after_insert_bump_lmod
AFTER INSERT ON tags BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS tags_after_update_bump_lmod
AFTER UPDATE ON tags BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- entry_tags
CREATE TRIGGER IF NOT EXISTS entry_tags_after_insert_bump_lmod
AFTER INSERT ON entry_tags BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS entry_tags_after_update_bump_lmod
AFTER UPDATE ON entry_tags BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- sources
CREATE TRIGGER IF NOT EXISTS sources_after_insert_bump_lmod
AFTER INSERT ON sources BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS sources_after_update_bump_lmod
AFTER UPDATE ON sources BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- relationship_types
CREATE TRIGGER IF NOT EXISTS relationship_types_after_insert_bump_lmod
AFTER INSERT ON relationship_types BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS relationship_types_after_update_bump_lmod
AFTER UPDATE ON relationship_types BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- entry_relationships
CREATE TRIGGER IF NOT EXISTS entry_relationships_after_insert_bump_lmod
AFTER INSERT ON entry_relationships BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;
CREATE TRIGGER IF NOT EXISTS entry_relationships_after_update_bump_lmod
AFTER UPDATE ON entry_relationships BEGIN
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

-- Hard-delete cascade: INSERT INTO deletes(table_name, id) DELETEs the matching
-- row outright (FK ON DELETE CASCADE then sweeps its children). The tombstone
-- row itself stays in `deletes` as the durable delete log + sync push queue.
-- Also bump `last_modified_at` so the delete advances the sync cursor (a DELETE
-- fires no per-table bump trigger of its own). DROP + CREATE (not IF NOT
-- EXISTS) so a re-run converges any DB holding an older body of this trigger.
DROP TRIGGER IF EXISTS process_delete_cascade;
CREATE TRIGGER process_delete_cascade AFTER INSERT ON deletes
BEGIN
  DELETE FROM entries             WHERE id = NEW.id AND NEW.table_name = 'entries';
  DELETE FROM texts               WHERE id = NEW.id AND NEW.table_name = 'texts';
  DELETE FROM senses              WHERE id = NEW.id AND NEW.table_name = 'senses';
  DELETE FROM sentences           WHERE id = NEW.id AND NEW.table_name = 'sentences';
  DELETE FROM senses_in_sentences WHERE id = NEW.id AND NEW.table_name = 'senses_in_sentences';
  DELETE FROM speakers            WHERE id = NEW.id AND NEW.table_name = 'speakers';
  DELETE FROM audio               WHERE id = NEW.id AND NEW.table_name = 'audio';
  DELETE FROM audio_speakers      WHERE id = NEW.id AND NEW.table_name = 'audio_speakers';
  DELETE FROM videos              WHERE id = NEW.id AND NEW.table_name = 'videos';
  DELETE FROM video_speakers      WHERE id = NEW.id AND NEW.table_name = 'video_speakers';
  DELETE FROM sense_videos        WHERE id = NEW.id AND NEW.table_name = 'sense_videos';
  DELETE FROM sentence_videos     WHERE id = NEW.id AND NEW.table_name = 'sentence_videos';
  DELETE FROM photos              WHERE id = NEW.id AND NEW.table_name = 'photos';
  DELETE FROM sense_photos        WHERE id = NEW.id AND NEW.table_name = 'sense_photos';
  DELETE FROM sentence_photos     WHERE id = NEW.id AND NEW.table_name = 'sentence_photos';
  DELETE FROM dialects            WHERE id = NEW.id AND NEW.table_name = 'dialects';
  DELETE FROM entry_dialects      WHERE id = NEW.id AND NEW.table_name = 'entry_dialects';
  DELETE FROM tags                WHERE id = NEW.id AND NEW.table_name = 'tags';
  DELETE FROM entry_tags          WHERE id = NEW.id AND NEW.table_name = 'entry_tags';
  DELETE FROM sources             WHERE id = NEW.id AND NEW.table_name = 'sources';
  DELETE FROM relationship_types  WHERE id = NEW.id AND NEW.table_name = 'relationship_types';
  DELETE FROM entry_relationships WHERE id = NEW.id AND NEW.table_name = 'entry_relationships';
  INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
END;

------------------------------------------------------------------
-- Convergence (no-op on freshly-provisioned DBs; heals pre-squash DBs).
-- Prune this section once no pre-squash DB remains.
------------------------------------------------------------------

-- Sweep rows whose tombstone landed while the 20260701b-era trigger was stale
-- (dev-window DBs recorded the draft migration without the trigger
-- re-declaration): the tombstone is already in `deletes`, so a retried delete
-- is an INSERT OR IGNORE no-op and the trigger never re-fires — without this
-- sweep those rows are permanently undeletable.
DELETE FROM relationship_types  WHERE id IN (SELECT id FROM deletes WHERE table_name = 'relationship_types');
DELETE FROM entry_relationships WHERE id IN (SELECT id FROM deletes WHERE table_name = 'entry_relationships');

-- Indexes the pre-squash chain created that no longer exist in the schema
-- above (redundant duplicates of a UNIQUE's leading column, or replaced —
-- see the 2026-07-02 schema audit).
DROP INDEX IF EXISTS idx_deletes_table_updated_at; -- replaced by idx_deletes_updated_at
DROP INDEX IF EXISTS idx_senses_in_sentences_sense;
DROP INDEX IF EXISTS idx_audio_speakers_audio;
DROP INDEX IF EXISTS idx_video_speakers_video;
DROP INDEX IF EXISTS idx_sense_videos_sense;
DROP INDEX IF EXISTS idx_sentence_videos_sentence;
DROP INDEX IF EXISTS idx_sense_photos_sense;
DROP INDEX IF EXISTS idx_sentence_photos_sentence;
DROP INDEX IF EXISTS idx_entry_dialects_entry;
DROP INDEX IF EXISTS idx_entry_tags_entry;
DROP INDEX IF EXISTS idx_entry_relationships_from;
