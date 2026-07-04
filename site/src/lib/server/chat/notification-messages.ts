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

function admin_user_url({ base_url, user_id }: { base_url: string, user_id: string }): string {
  return `${base_url}/admin/users/${user_id}`
}

function linked_user_html({ label, base_url, user_id }: { label: string, base_url: string, user_id?: string | null }): string {
  if (!user_id)
    return escape_html(label)
  const url = admin_user_url({ base_url, user_id })
  return `<a href="${escape_html(url)}">${escape_html(label)}</a>`
}

function append_user_url({ text, base_url, user_id }: { text: string, base_url: string, user_id?: string | null }): string {
  if (!user_id)
    return text
  return `${text} — ${admin_user_url({ base_url, user_id })}`
}

export function format_new_dictionary_notification({ dictionary_name, dictionary_id, actor, actor_user_id, base_url }: {
  dictionary_name: string
  dictionary_id: string
  /** Creator's display name or email. */
  actor: string
  actor_user_id?: string | null
  base_url: string
}): SystemNotificationContent {
  const url = `${base_url}/${dictionary_id}`
  const body_text = `${actor} created a new dictionary "${dictionary_name}" — ${url}`
  return {
    subject: 'New dictionary created',
    body_text: append_user_url({ text: body_text, base_url, user_id: actor_user_id }),
    body_html: `<p>${linked_user_html({ label: actor, base_url, user_id: actor_user_id })} created a new dictionary <a href="${escape_html(url)}">${escape_html(dictionary_name)}</a>.</p>`,
  }
}

export function format_new_user_notification({ actor, email, user_id, base_url }: {
  /** New user's display name (or email when unnamed). */
  actor: string
  email: string | null
  user_id?: string | null
  base_url: string
}): SystemNotificationContent {
  const tail = email && email !== actor ? ` (${email})` : ''
  const body_text = `${actor}${tail} just signed up`
  return {
    subject: 'New user signed up',
    body_text: append_user_url({ text: body_text, base_url, user_id }),
    body_html: `<p>${linked_user_html({ label: actor, base_url, user_id })}${escape_html(tail)} just signed up.</p>`,
  }
}

export function format_invite_notification({ actor, actor_user_id, target_email, role, dictionary_name, dictionary_id, base_url }: {
  /** Inviter's display name or email. */
  actor: string
  actor_user_id?: string | null
  target_email: string
  role: 'manager' | 'contributor'
  dictionary_name: string
  dictionary_id: string
  base_url: string
}): SystemNotificationContent {
  const url = `${base_url}/${dictionary_id}`
  const body_text = `${actor} invited ${target_email} as ${role} on "${dictionary_name}" — ${url}`
  return {
    subject: 'New invitation sent',
    body_text: append_user_url({ text: body_text, base_url, user_id: actor_user_id }),
    body_html: `<p>${linked_user_html({ label: actor, base_url, user_id: actor_user_id })} invited ${escape_html(target_email)} as ${role} on <a href="${escape_html(url)}">${escape_html(dictionary_name)}</a>.</p>`,
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

    it('links the creator when a user id is available', () => {
      const content = format_new_dictionary_notification({ dictionary_name: 'Test', dictionary_id: 'd1', actor: 'Jane', actor_user_id: 'u1', base_url: 'https://ld.app' })
      expect(content.body_html).toContain('<a href="https://ld.app/admin/users/u1">Jane</a>')
      expect(content.body_text).toContain('https://ld.app/admin/users/u1')
    })
  })

  describe(format_new_user_notification, () => {
    it('appends the email only when it differs from the display name', () => {
      expect(format_new_user_notification({ actor: 'Jane', email: 'jane@b.com', base_url: 'https://ld.app' }).body_text).toBe('Jane (jane@b.com) just signed up')
      expect(format_new_user_notification({ actor: 'jane@b.com', email: 'jane@b.com', base_url: 'https://ld.app' }).body_text).toBe('jane@b.com just signed up')
    })

    it('links the new user when a user id is available', () => {
      const content = format_new_user_notification({ actor: 'Jane', email: 'jane@b.com', user_id: 'u1', base_url: 'https://ld.app' })
      expect(content.body_html).toContain('<a href="https://ld.app/admin/users/u1">Jane</a> (jane@b.com) just signed up.')
      expect(content.body_text).toBe('Jane (jane@b.com) just signed up — https://ld.app/admin/users/u1')
    })
  })

  describe(format_invite_notification, () => {
    it('links the inviter when a user id is available', () => {
      const content = format_invite_notification({ actor: 'Jane', actor_user_id: 'u1', target_email: 'target@example.com', role: 'manager', dictionary_name: 'Test', dictionary_id: 'd1', base_url: 'https://ld.app' })
      expect(content.body_html).toContain('<a href="https://ld.app/admin/users/u1">Jane</a> invited target@example.com')
      expect(content.body_text).toContain('https://ld.app/admin/users/u1')
    })
  })
}
