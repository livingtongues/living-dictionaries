/**
 * Pure formatters for the System-notification messages posted into the
 * Notifications room (and used as the ntfy/email ping subject + body). Values
 * are user-controlled (dictionary names, emails, display names), so `body_html`
 * always escapes them — the room renders `body_html` as trusted HTML.
 */
import { escape_html } from './notification-email'

export interface SystemNotificationContent {
  /** Short title — the ntfy/email ping subject. */
  subject: string
  /** Plain-text body — the message mirror + ping body. */
  body_text: string
  /** Rendered HTML for the chat message body. */
  body_html: string
}

export function format_new_dictionary_notification({ dictionary_name, dictionary_id, actor, base_url }: {
  dictionary_name: string
  dictionary_id: string
  /** Creator's display name or email. */
  actor: string
  base_url: string
}): SystemNotificationContent {
  const url = `${base_url}/${dictionary_id}`
  return {
    subject: 'New dictionary created',
    body_text: `${actor} created a new dictionary "${dictionary_name}" — ${url}`,
    body_html: `<p>${escape_html(actor)} created a new dictionary <a href="${escape_html(url)}">${escape_html(dictionary_name)}</a>.</p>`,
  }
}

export function format_new_user_notification({ actor, email }: {
  /** New user's display name (or email when unnamed). */
  actor: string
  email: string | null
}): SystemNotificationContent {
  const tail = email && email !== actor ? ` (${email})` : ''
  return {
    subject: 'New user signed up',
    body_text: `${actor}${tail} just signed up`,
    body_html: `<p>${escape_html(actor)}${escape_html(tail)} just signed up.</p>`,
  }
}

export function format_invite_notification({ actor, target_email, role, dictionary_name, dictionary_id, base_url }: {
  /** Inviter's display name or email. */
  actor: string
  target_email: string
  role: 'manager' | 'contributor'
  dictionary_name: string
  dictionary_id: string
  base_url: string
}): SystemNotificationContent {
  const url = `${base_url}/${dictionary_id}`
  return {
    subject: 'New invitation sent',
    body_text: `${actor} invited ${target_email} as ${role} on "${dictionary_name}" — ${url}`,
    body_html: `<p>${escape_html(actor)} invited ${escape_html(target_email)} as ${role} on <a href="${escape_html(url)}">${escape_html(dictionary_name)}</a>.</p>`,
  }
}

if (import.meta.vitest) {
  describe(format_new_dictionary_notification, () => {
    it('escapes user-controlled values in body_html but leaves body_text raw', () => {
      const content = format_new_dictionary_notification({ dictionary_name: '<script>x</script>', dictionary_id: 'd1', actor: 'a@b.com', base_url: 'https://ld.app' })
      expect(content.body_html).toContain('&lt;script&gt;')
      expect(content.body_html).not.toContain('<script>')
      expect(content.body_text).toContain('<script>x</script>')
      expect(content.subject).toBe('New dictionary created')
    })
  })

  describe(format_new_user_notification, () => {
    it('appends the email only when it differs from the display name', () => {
      expect(format_new_user_notification({ actor: 'Jane', email: 'jane@b.com' }).body_text).toBe('Jane (jane@b.com) just signed up')
      expect(format_new_user_notification({ actor: 'jane@b.com', email: 'jane@b.com' }).body_text).toBe('jane@b.com just signed up')
    })
  })
}
