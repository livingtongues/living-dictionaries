-- Consolidated initial migration for the per-dictionary change-history db
-- (`dictionaries/{id}.history.db`) — pre-cutover squash of the 2026-06-23 →
-- 2026-06-30 chain, 2026-07-02. This file is SEPARATE from the main dict db on
-- purpose: history is server-only, never synced to clients and never included
-- in R2 viewer snapshots, so the main dict db + its snapshots stay lean while
-- history grows unbounded here.
--
-- IDEMPOTENT BY DESIGN: migration runners apply by NAME, so this file re-runs
-- as a no-op over any history db provisioned from the pre-squash chain.
--
-- Written at the single server merge chokepoint (`process_dict_changes`),
-- appended AFTER the main-db commit (best-effort — SQLite can't atomically
-- commit across two files in WAL mode; losing at most one audit event in a
-- crash window is acceptable, the actual data is always safe).
--
-- Schema-drift survival: all volatile shape lives inside the opaque JSON
-- `snapshot`/`delta` columns. Additive content-table migrations need ZERO
-- history upkeep; a dropped/renamed column simply stays frozen in old
-- snapshots and renders generically.

CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  run_on TEXT NOT NULL
);

-- One row per recorded change to a content-table row.
CREATE TABLE IF NOT EXISTS changes (
  id         TEXT PRIMARY KEY,         -- uuid
  table_name TEXT NOT NULL,            -- which content table changed
  row_id     TEXT NOT NULL,            -- the changed row's id
  op         TEXT NOT NULL,            -- 'insert' | 'update' | 'delete'
  user_id    TEXT NOT NULL,            -- authenticated pusher (merge's updated_by)
  at         TEXT NOT NULL,            -- SERVER receive time; shared by one push batch
  snapshot   TEXT NOT NULL,            -- JSON after-image: parsed row, NULL cols stripped,
                                       --   minus dirty/updated_at/updated_by_user_id.
                                       --   For a delete this is the final pre-delete image.
  delta      TEXT,                     -- JSON {col:{old,new}} for updates; NULL for insert/delete
  -- Agent attribution: when a change is made through the `/api/v1` write API
  -- with an `ldk_` API key, records WHICH key (= which agent) did it. `user_id`
  -- already holds the responsible human (the key's creator); this column
  -- annotates that a specific agent acted on their behalf. NULL = a human
  -- edited directly in the UI. References `shared.db.api_keys.id` (cross-file,
  -- so no SQL FK). Keys are revoked, never hard-deleted, so the id always
  -- resolves back to a label + creator for the timeline.
  api_key_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_changes_row ON changes(table_name, row_id);
CREATE INDEX IF NOT EXISTS idx_changes_at  ON changes(at);
CREATE INDEX IF NOT EXISTS idx_changes_api_key ON changes(api_key_id);

-- Many-to-many "which browse-subject(s) does this change belong to" index.
-- owner_type is an open-ended string ('entry' | 'text' | 'sentence' today);
-- a new prince later is a new value, never a migration.
CREATE TABLE IF NOT EXISTS change_owners (
  change_id  TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL,
  owner_id   TEXT NOT NULL,
  PRIMARY KEY (change_id, owner_type, owner_id)
);
CREATE INDEX IF NOT EXISTS idx_change_owners_lookup ON change_owners(owner_type, owner_id);
