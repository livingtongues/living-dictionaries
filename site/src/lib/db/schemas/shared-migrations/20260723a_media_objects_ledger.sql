------------------------------------------------------------------
-- Media storage ledger (server-only, like the chat/i18n/featured_entries
-- tables — NOT in SYNCABLE_TABLE_NAMES, never synced to clients).
--
-- One row per R2 media-bucket object. Kept true by: upload-time inserts
-- (photo-upload endpoint, /api/upload presign, v1 media writes, variant
-- generation) + the weekly media sweep (R2 listing true-up, orphan
-- grace-period deletion, missing-variant self-heal). Seeded at migration time
-- from the GCS→R2 driver's state.db (exact byte sizes + dict-row created_at).
--
-- media_storage_daily: daily per-dict/type rollup snapshots read by
-- /admin/storage (trends). Backfilled once from ledger uploaded_at (cumulative
-- growth of surviving objects), rolled forward daily by the sweep cron.
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_objects (
  key TEXT PRIMARY KEY,
  dict_id TEXT NOT NULL,
  media_type TEXT NOT NULL,           -- 'audio' | 'video' | 'photo'
  is_variant INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL,
  last_seen_at TEXT,                  -- last R2-listing confirmation (sweep)
  orphaned_at TEXT                    -- no live row references it; deleted after ~30d grace
);
CREATE INDEX IF NOT EXISTS idx_media_objects_dict ON media_objects(dict_id);
CREATE INDEX IF NOT EXISTS idx_media_objects_orphaned ON media_objects(orphaned_at) WHERE orphaned_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS media_storage_daily (
  date TEXT NOT NULL,                 -- YYYY-MM-DD
  dict_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  object_count INTEGER NOT NULL,
  PRIMARY KEY (date, dict_id, media_type)
);
