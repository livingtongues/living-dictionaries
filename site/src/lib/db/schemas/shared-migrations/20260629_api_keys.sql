------------------------------------------------------------------
-- Per-dictionary API keys for the agent-friendly /api/v1 write API.
--
-- A dictionary manager mints a key in Settings; it grants programmatic write
-- access (default 'manager') scoped to THAT ONE dictionary. Pasted into an
-- agent, the key lets it do any edit a human editor could, in bulk, via
-- /api/v1/dictionaries/:id/*.
--
-- SERVER-ONLY (like email_codes / client_logs / chat): the raw token is shown
-- ONCE on creation and only its sha-256 hash is stored. Hashes must never reach
-- an admin's browser, so this table is absent from SYNCABLE_TABLE_NAMES and has
-- no `dirty` column — the sync engine never touches it. Created-but-empty on
-- admin clients.
--
-- `created_by_user_id` is the human who minted the key; API writes are
-- attributed to them (updated_by_user_id stamping in process_dict_changes).
-- `last_used_at` is touched at most ~once/minute per key (throttled) so reads
-- don't hammer the row. `revoked_at` is a soft kill-switch (verify rejects when
-- non-null) — managers can also hard-DELETE the row.
------------------------------------------------------------------

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  dictionary_id TEXT NOT NULL REFERENCES dictionaries (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,    -- sha-256 hex of the raw token; never store the token
  token_prefix TEXT NOT NULL,         -- leading chars for display, e.g. 'ldk_a1b2c3'
  last_four TEXT NOT NULL,            -- trailing 4 chars for display
  label TEXT NOT NULL,               -- human-given name for the key
  role TEXT NOT NULL DEFAULT 'manager', -- 'manager' | 'editor' | 'contributor'
  created_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE INDEX idx_api_keys_dictionary ON api_keys (dictionary_id);
CREATE INDEX idx_api_keys_token_hash ON api_keys (token_hash);
