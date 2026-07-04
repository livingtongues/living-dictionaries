------------------------------------------------------------------
-- Curation-bucket pivot (2026-07-04): `featured_entries` becomes the shared
-- candidate BUCKET the homepage showcase is curated from, filled from two
-- sources:
--   'agent'       — curate-command harvests (photo+audio entries, ~5/public dict)
--   'editor_star' — dictionary editors' starred entries (per-dict dict.db
--                   `featured_entries` rows) swept in by the curate command
-- Status flow is unchanged (suggested → approved/rejected); approved rows bake
-- onto the homepage. New snapshot columns power the homepage card MODAL (richer
-- than the card without kicking off a dict snapshot download). Columns are
-- nullable — pre-pivot rows render a degraded modal until backfilled.
------------------------------------------------------------------
ALTER TABLE featured_entries ADD COLUMN source TEXT NOT NULL DEFAULT 'agent';
ALTER TABLE featured_entries ADD COLUMN phonetic TEXT;
ALTER TABLE featured_entries ADD COLUMN glosses TEXT; -- JSON MultiString (ALL gloss languages, not just the card's pick)
ALTER TABLE featured_entries ADD COLUMN speaker_name TEXT;
ALTER TABLE featured_entries ADD COLUMN example_sentence TEXT; -- JSON { text: MultiString, translation: MultiString }
ALTER TABLE featured_entries ADD COLUMN starred_at TEXT; -- dict-db star created_at — the editor_star sweep's per-dict watermark
------------------------------------------------------------------
-- Dictionary buckets (2026-07-04): admin-curated classification of every
-- dictionary so we know who we serve vs what we tolerate vs what gets deleted.
--   'public'   — real dictionary, publicly listed (known good)
--   'unlisted' — real dictionary, private; people we desire to serve
--   'secure'   — FUTURE: key-code-locked dictionary (reserved, no rows yet)
--   'conlang'  — constructed language; tolerated, media storage to be disabled
--   'glossary' — wordlist/classroom glossary; tolerated, media storage to be disabled
--   'delete'   — queued for teardown (explorers who moved on)
-- NULL = unclassified (new dictionaries land here until reviewed).
-- Backfilled by a one-time server-side script; curated in /admin.
------------------------------------------------------------------
ALTER TABLE dictionaries ADD COLUMN bucket TEXT;

-- First time the dictionary went public. NULL for dictionaries already public
-- before this migration (history unknown) — stamped by trigger from now on.
ALTER TABLE dictionaries ADD COLUMN public_at TEXT;

-- Stamp public_at on FIRST publish only (public_at never moves once set).
-- Runs on the server AND on admin client mirrors (same migrations bundle):
--   - pulled updates of already-public dicts don't fire (OLD.public = 1)
--   - a publish pulled from the server arrives with public_at already stamped
--     server-side, so NEW.public_at IS NULL blocks a re-stamp
--   - deliberately NO "AFTER INSERT" twin: an admin client's initial sync
--     INSERTs every historical public dict and would mis-stamp them with the
--     sync time.
CREATE TRIGGER IF NOT EXISTS stamp_dictionary_public_at
AFTER UPDATE OF public ON dictionaries
WHEN NEW.public = 1 AND (OLD.public IS NULL OR OLD.public = 0) AND NEW.public_at IS NULL
BEGIN
  UPDATE dictionaries SET public_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
