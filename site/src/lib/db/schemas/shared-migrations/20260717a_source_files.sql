-- Import resources uploaded by dictionary managers (any format — spreadsheets,
-- FLEx/LIFT, Toolbox, PDF scans of printed dictionaries…). Bytes live in the
-- private R2 attachments bucket under `import/{dictionary_id}/{file_id}`;
-- this table is the durable metadata + per-file import instructions.
--
-- SERVER-ONLY: deliberately NOT in the shared-sync allowlist
-- (`$lib/db/sync/types.ts`) — filenames + instructions must never reach
-- non-manager clients. Managers/admins read it via gated endpoints
-- (`/api/v1/dictionaries/{id}/files`).
CREATE TABLE IF NOT EXISTS source_files (
  id TEXT PRIMARY KEY,
  dictionary_id TEXT NOT NULL,
  source_id TEXT,                -- dict-db sources.id once linked (cross-db, no FK)
  filename TEXT NOT NULL,
  mimetype TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL,     -- R2 key in the attachments bucket
  import_instructions TEXT,      -- how the uploader wants this imported (required before requesting)
  source_note TEXT,              -- optional citation/provenance written by the uploader
  upload_confirmed_at TEXT,      -- set once the client confirms the R2 PUT landed
  import_requested_at TEXT,      -- set when an import request message was sent
  import_thread_id TEXT,         -- message_threads.id of that request
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_source_files_dictionary ON source_files(dictionary_id);
