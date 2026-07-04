------------------------------------------------------------------
-- Homepage word showcase: agent-curated entries (photo + audio) from public
-- dictionaries. Server-only (like the chat/i18n tables) — reached via
-- /api/admin/featured-entries (curation review) and /api/homepage/export
-- (build-time bake). Never a sync sector, no dirty column.
--
-- Content columns are snapshots taken at curation time (the homepage bakes
-- at build anyway); re-running the curation refresh updates them.
-- status: 'suggested' (agent-picked, awaiting review) | 'approved' | 'rejected'
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS featured_entries (
  id TEXT PRIMARY KEY,
  dict_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  sense_id TEXT,
  photo_id TEXT,
  audio_id TEXT,
  lexeme TEXT NOT NULL,
  gloss TEXT,
  gloss_language TEXT,
  photo_serving_url TEXT NOT NULL,
  audio_storage_path TEXT NOT NULL,
  dict_name TEXT NOT NULL,
  longitude REAL,
  latitude REAL,
  status TEXT NOT NULL DEFAULT 'suggested',
  agent_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (dict_id, entry_id)
);
CREATE INDEX IF NOT EXISTS idx_featured_entries_status ON featured_entries(status);
