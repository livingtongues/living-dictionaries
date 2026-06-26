------------------------------------------------------------------
-- AI inbound-message triage (port from house; see
-- .issues/ai-triage-pipeline.md). An LLM (xAI Grok grok-4.3) classifies each
-- inbound customer email and the server writes the verdict + a suggested reply
-- here. The model has NO tools — it only returns structured JSON the server
-- applies. A human reviews everything (nothing is auto-sent).
--
-- These columns live on message_threads (already in SYNCABLE_TABLE_NAMES) so
-- they ride to admin clients via the existing single-sector sync — no
-- sync-config change. The triage panel reads them off the live row.
--
--   triage_verdict      'spam' | 'human' (LLM) | 'notification' (auto-resolver
--                       marker the LLM never emits)
--   triage_category     'technical' | 'content' | 'account' | 'partnership'
--                       | 'other' — NULL for notifications
--   triage_confidence   'high' | 'low' — low-confidence routes to Jacob
--   triage_summary      one concise line for the admin inbox
--   triage_advice       internal admin-facing guidance (never shown to customer)
--   triage_draft_reply  customer-facing draft, or NULL when withheld
--                       (spam + partnership are always withheld)
--   triage_at           ISO 8601 timestamp the triage ran
--
-- Pipeline is fully env-gated on XAI_API_KEY → inert until the key is set.
------------------------------------------------------------------

ALTER TABLE message_threads ADD COLUMN triage_verdict TEXT;
ALTER TABLE message_threads ADD COLUMN triage_category TEXT;
ALTER TABLE message_threads ADD COLUMN triage_confidence TEXT;
ALTER TABLE message_threads ADD COLUMN triage_summary TEXT;
ALTER TABLE message_threads ADD COLUMN triage_advice TEXT;
ALTER TABLE message_threads ADD COLUMN triage_draft_reply TEXT;
ALTER TABLE message_threads ADD COLUMN triage_at TEXT;

------------------------------------------------------------------
-- Singleton agent system user. Agent-applied writes (auto-assign /
-- auto-resolve) stamp assigned_by_user_id / resolved_by_user_id =
-- this id, so the FK must resolve. Seeded on the server's shared.db AND
-- (idempotently) on every admin client's local DB; it also rides down via the
-- download-only users sync. Email is on our own domain so is_internal_email()
-- treats any stray reply as internal. Keep this id in sync with
-- AGENT_USER_ID in $lib/agent/triage/constants.ts.
------------------------------------------------------------------

INSERT OR IGNORE INTO users (id, email, name, providers, created_at, updated_at)
VALUES (
  '5a12e3e0-03eb-489f-a23b-23cc3d2a1c12',
  'agent@livingdictionaries.app',
  'LD Triage',
  '[]',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
