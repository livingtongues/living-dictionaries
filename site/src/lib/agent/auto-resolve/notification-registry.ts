/**
 * Registry of automated machine-notification senders whose informational mail we
 * auto-resolve at ingest — no human attention, no ntfy push, no (paid) LLM
 * triage. See `.issues/ai-triage-pipeline.md`.
 *
 * Living Dictionaries has no billing/Stripe, so this starts minimal: bounce /
 * delivery-failure notices from mailer-daemon / postmaster, which are pure noise
 * once logged. (Our own `@livingdictionaries.app` OTP/no-reply loops are already
 * skipped upstream by `is_internal_email`, before triage even runs.)
 *
 * Safe-by-default: a sender only auto-resolves when BOTH (a) its `subject`
 * matches one of the sender's positive `informational` patterns AND (b) the
 * subject hits none of the global `BLOCKERS`. Under-matching just means extra
 * triage; over-matching could swallow something a human should see — so we keep
 * the allowlist tight.
 */

export interface NotificationSenderRule {
  /** Stable id for logs. */
  id: string
  /** Human label for the resolved-note shown in the admin panel. */
  label: string
  /** True when an inbound `from_email` belongs to this sender. */
  matches_sender: (from_email: string) => boolean
  /** Subject patterns that mark this as a routine informational notice. */
  informational: readonly RegExp[]
}

/**
 * Subjects that must NEVER auto-resolve even if a positive pattern also hits —
 * a belt-and-suspenders guard against actionable notices.
 */
const BLOCKERS: readonly RegExp[] = [
  /action required|requires (?:your |action|verification)|verify|verification/i,
  /fraud|suspicious|at risk|on hold|under review|restricted|suspended|compromised/i,
]

/** local-part of a from_email, lowercased. */
function local_part(email: string): string {
  const at = email.lastIndexOf('@')
  return at === -1 ? email : email.slice(0, at)
}

export const NOTIFICATION_SENDERS: readonly NotificationSenderRule[] = [
  {
    id: 'mailer-daemon',
    label: 'Mail delivery / bounce notice — informational, no action needed.',
    matches_sender: (email) => {
      const local = local_part(email)
      return local === 'mailer-daemon' || local === 'postmaster'
    },
    informational: [
      /^(?:mail )?delivery (?:status notification|failed|has failed|subsystem)/i,
      /^undeliverable/i,
      /^(?:returned mail|delivery failure|failure notice)/i,
    ],
  },
]

export interface NotificationMatch {
  sender_id: string
  label: string
}

/**
 * Returns the auto-resolve decision for an inbound message, or `null` when it
 * should go through normal handling. Non-null ⇒ resolve silently.
 */
export function match_notification({ from_email, subject }: {
  from_email: string
  subject: string | null | undefined
}): NotificationMatch | null {
  const email = (from_email || '').trim().toLowerCase()
  const sender = NOTIFICATION_SENDERS.find(rule => rule.matches_sender(email))
  if (!sender)
    return null

  const subj = (subject || '').trim()
  if (!subj)
    return null
  if (BLOCKERS.some(blocker => blocker.test(subj)))
    return null
  if (!sender.informational.some(pattern => pattern.test(subj)))
    return null

  return { sender_id: sender.id, label: sender.label }
}

if (import.meta.vitest) {
  describe(match_notification, () => {
    const daemon = 'mailer-daemon@googlemail.com'

    test('auto-resolves a delivery-failure bounce', () => {
      const match = match_notification({
        from_email: daemon,
        subject: 'Delivery Status Notification (Failure)',
      })
      expect(match?.sender_id).toBe('mailer-daemon')
    })

    test('auto-resolves an undeliverable notice from postmaster', () => {
      expect(match_notification({ from_email: 'postmaster@example.com', subject: 'Undeliverable: Your message' })).not.toBeNull()
    })

    test('blocker wins even when a positive pattern also matches', () => {
      expect(match_notification({ from_email: daemon, subject: 'Delivery failed — action required' })).toBeNull()
    })

    test('ignores non-registered senders', () => {
      expect(match_notification({ from_email: 'reader@gmail.com', subject: 'Delivery Status Notification' })).toBeNull()
    })

    test('handles casing + missing/empty subject', () => {
      expect(match_notification({ from_email: 'Mailer-Daemon@Mail.com', subject: 'UNDELIVERABLE' })).not.toBeNull()
      expect(match_notification({ from_email: daemon, subject: null })).toBeNull()
      expect(match_notification({ from_email: daemon, subject: '' })).toBeNull()
    })

    test('unrecognized daemon subject falls through to triage', () => {
      expect(match_notification({ from_email: daemon, subject: 'Your weekly digest' })).toBeNull()
    })
  })
}
