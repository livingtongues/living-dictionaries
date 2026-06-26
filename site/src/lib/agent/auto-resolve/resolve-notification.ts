import type Database from 'better-sqlite3'
import { AGENT_USER_ID } from '$lib/agent/triage/constants'

/**
 * Mark a thread as an auto-resolved machine notification — server-originated by
 * the agent system user, so admin clients pull it on the next `messages` sector
 * sync (`dirty` stays NULL). Reuses the `triage_*` columns + the triage panel
 * (parallels the spam-resolved path): a `notification` verdict the LLM can never
 * emit, plus a one-line summary. No category/confidence/advice/draft.
 */
export function resolve_notification_thread({ db, thread_id, label, now }: {
  db: Database.Database
  thread_id: string
  label: string
  now: string
}): void {
  db.prepare(`
    UPDATE message_threads SET
      triage_verdict = 'notification',
      triage_category = NULL,
      triage_confidence = NULL,
      triage_summary = ?,
      triage_advice = NULL,
      triage_draft_reply = NULL,
      triage_at = ?,
      resolved_at = ?,
      resolved_by_user_id = ?,
      updated_at = ?
    WHERE id = ?
  `).run(label, now, now, AGENT_USER_ID, now, thread_id)
}
