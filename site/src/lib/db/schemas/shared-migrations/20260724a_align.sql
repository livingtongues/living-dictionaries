-- M6 forced-alignment (see .issues/auto-align-timings.md).
--
-- dictionaries.align_config: admin-only JSON — how this dictionary's tokens
-- become MMS-alignable a-z' align_forms (`AlignConfig` in shared.types.ts).
-- NULL = alignment not configured (Auto-align button hidden). White-glove:
-- set per dictionary on /admin, never shown to managers.
ALTER TABLE dictionaries ADD COLUMN align_config TEXT;

-- SERVER-ONLY job ledger (like source_files: deliberately NOT in the
-- shared-sync allowlist). One row per alignment run — doubles as the
-- rate-limit counter (per-dict + global daily caps count today's rows).
CREATE TABLE IF NOT EXISTS align_jobs (
  id TEXT PRIMARY KEY,
  dictionary_id TEXT NOT NULL,
  target_kind TEXT NOT NULL,     -- 'text' | 'sentence'
  target_id TEXT NOT NULL,       -- dict-db texts.id | sentences.id (cross-db, no FK)
  audio_id TEXT NOT NULL,        -- dict-db audio.id
  status TEXT NOT NULL,          -- 'running' | 'done' | 'failed'
  error TEXT,                    -- failure detail (also holds coverage-gap summary on done)
  tokens_total INTEGER,          -- word tokens sent
  tokens_aligned INTEGER,        -- word tokens that got a derived align_form
  requested_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  requested_via TEXT,            -- 'ui' | 'v1' | 'auto'
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_align_jobs_dictionary ON align_jobs(dictionary_id, created_at);
CREATE INDEX IF NOT EXISTS idx_align_jobs_created ON align_jobs(created_at);
