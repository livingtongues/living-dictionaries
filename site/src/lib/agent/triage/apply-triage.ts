import type Database from 'better-sqlite3'
import type { TriageResult } from './types'
import type { Admin } from '$lib/admins'
import { env } from '$env/dynamic/private'
import { notify_admin } from '$lib/notifications/notify-admins'
import { AGENT_USER_ID } from './constants'
import { fallback_admin, route_admin_for_category } from './routing'

const PUBLIC_BASE_URL = env.ORIGIN || 'https://new.livingdictionaries.app'

export type TriageAction = 'spam_resolved' | 'auto_assigned' | 'low_confidence_review'

export interface TriageDecision {
  action: TriageAction
  /** Admin to assign the thread to, or undefined (spam isn't assigned). */
  assignee: Admin | undefined
  /** Mark the thread resolved (spam only). */
  resolve: boolean
  /** Admin to ping about this thread. */
  notify: Admin | undefined
}

/**
 * Pure routing decision from a triage result. Kept side-effect-free so the
 * branching is unit-testable without a DB.
 *
 *  - spam            → resolve + mark spam + ping Jacob (trust-building period;
 *                      also catches phishing that masquerades as account/billing).
 *  - human + high    → auto-assign per category + ping that admin.
 *  - human + low     → assign to Jacob ("if you don't have confidence, that
 *                      comes to me") + ping Jacob; the category badge still shows.
 */
export function decide_actions(result: TriageResult): TriageDecision {
  if (result.verdict === 'spam') {
    const jacob = fallback_admin()
    return { action: 'spam_resolved', assignee: undefined, resolve: true, notify: jacob }
  }
  if (result.confidence === 'high') {
    const admin = route_admin_for_category(result.category)
    return { action: 'auto_assigned', assignee: admin, resolve: false, notify: admin }
  }
  const jacob = fallback_admin()
  return { action: 'low_confidence_review', assignee: jacob, resolve: false, notify: jacob }
}

interface ThreadMeta {
  subject: string | null
  from_name: string | null
  from_email: string
}

/**
 * Persist the triage result to `message_threads` and perform the server-side
 * actions (assign / resolve) + targeted ntfy/email. All writes are
 * server-originated (the agent system user), so admin clients pull them on the
 * next `messages` sector sync.
 */
export function apply_triage({ db, thread_id, result }: {
  db: Database.Database
  thread_id: string
  result: TriageResult
}): TriageDecision {
  const thread = db.prepare('SELECT subject, from_name, from_email FROM message_threads WHERE id = ?')
    .get(thread_id) as ThreadMeta | undefined
  if (!thread)
    throw new Error(`apply_triage: thread ${thread_id} not found`)

  const decision = decide_actions(result)
  const now = new Date().toISOString()

  // Resolve the assignee to a real users row (admins are created lazily on first
  // login — if absent, skip the FK write but still ping + store the triage).
  let assignee_user_id: string | null = null
  if (decision.assignee) {
    const row = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE LIMIT 1')
      .get(decision.assignee.email) as { id: string } | undefined
    assignee_user_id = row?.id ?? null
  }

  db.prepare(`
    UPDATE message_threads SET
      triage_verdict = ?, triage_category = ?, triage_confidence = ?,
      triage_summary = ?, triage_advice = ?, triage_draft_reply = ?, triage_at = ?,
      assigned_to_user_id = COALESCE(?, assigned_to_user_id),
      assigned_at = CASE WHEN ? IS NOT NULL THEN ? ELSE assigned_at END,
      assigned_by_user_id = CASE WHEN ? IS NOT NULL THEN ? ELSE assigned_by_user_id END,
      resolved_at = CASE WHEN ? THEN ? ELSE resolved_at END,
      resolved_by_user_id = CASE WHEN ? THEN ? ELSE resolved_by_user_id END,
      updated_at = ?
    WHERE id = ?
  `).run(
    result.verdict, result.category, result.confidence,
    result.summary, result.advice, result.draft_reply, now,
    assignee_user_id,
    assignee_user_id, now,
    assignee_user_id, AGENT_USER_ID,
    decision.resolve ? 1 : 0, now,
    decision.resolve ? 1 : 0, AGENT_USER_ID,
    now,
    thread_id,
  )

  const who = thread.from_name || thread.from_email
  const link = `${PUBLIC_BASE_URL}/admin/messages/${thread_id}`
  if (decision.notify) {
    if (decision.action === 'spam_resolved') {
      void notify_admin({
        email: decision.notify.email,
        subject: `Spam auto-resolved: ${thread.subject || '(no subject)'}`,
        body: `Triage marked a message from ${who} as spam and resolved it.${result.spam_reason ? ` Reason: ${result.spam_reason}` : ''}`,
        link,
      })
    } else {
      const prefix = decision.action === 'low_confidence_review' ? 'Triage (needs routing)' : `Triage → ${decision.notify.name}`
      void notify_admin({
        email: decision.notify.email,
        subject: `${prefix}: ${thread.subject || '(no subject)'}`,
        body: `${result.summary} — from ${who} (${result.category}, ${result.confidence} confidence).`,
        link,
      })
    }
  }

  return decision
}

if (import.meta.vitest) {
  const base: TriageResult = {
    verdict: 'human', category: 'technical', confidence: 'high',
    summary: 's', advice: 'a', draft_reply: 'd', spam_reason: null,
  }

  test('spam → resolve + ping Jacob, no assignee', () => {
    const d = decide_actions({ ...base, verdict: 'spam', draft_reply: null, spam_reason: 'phish' })
    expect(d.action).toBe('spam_resolved')
    expect(d.resolve).toBe(true)
    expect(d.assignee).toBeUndefined()
    expect(d.notify?.name).toBe('Jacob Bowdoin')
  })

  test('high-confidence technical → assign + ping Jacob', () => {
    const d = decide_actions({ ...base, category: 'technical', confidence: 'high' })
    expect(d.action).toBe('auto_assigned')
    expect(d.assignee?.name).toBe('Jacob Bowdoin')
    expect(d.notify?.name).toBe('Jacob Bowdoin')
    expect(d.resolve).toBe(false)
  })

  test('high-confidence content → Diego', () => {
    const d = decide_actions({ ...base, category: 'content', confidence: 'high' })
    expect(d.assignee?.name).toBe('Diego Córdova')
  })

  test('high-confidence account → Jacob', () => {
    const d = decide_actions({ ...base, category: 'account', confidence: 'high' })
    expect(d.assignee?.name).toBe('Jacob Bowdoin')
  })

  test('low confidence → Jacob review', () => {
    const d = decide_actions({ ...base, category: 'content', confidence: 'low' })
    expect(d.action).toBe('low_confidence_review')
    expect(d.assignee?.name).toBe('Jacob Bowdoin')
    expect(d.resolve).toBe(false)
  })
}
