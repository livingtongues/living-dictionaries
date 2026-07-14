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

/**
 * Substrings the daily digest matches in each notification's `body_text` to
 * categorize it. They're the invariant phrases baked into the three formatters
 * below — the `import.meta.vitest` block asserts each formatter's output still
 * contains its marker, so the categorization can't silently drift.
 */
export const NEW_USER_MARKER = 'signed up'
export const NEW_DICTIONARY_MARKER = 'created a new dictionary'
export const INVITE_MARKER = 'invited'

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

/** Join a list of phrases naturally: "a", "a and b", "a, b, and c". */
function natural_join(parts: string[]): string {
  if (parts.length <= 1)
    return parts.join('')
  if (parts.length === 2)
    return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

/**
 * Roll up a batch of unread Notifications-room messages into ONE digest line for
 * the daily 8am-Pacific ping — e.g. "5 new users and 2 new dictionaries".
 * Categorizes by matching each message's `body_text` against the markers above;
 * anything unrecognized falls into a generic "other notifications" bucket so the
 * total always adds up.
 */
export function summarize_notifications({ messages }: { messages: readonly { body_text: string }[] }): {
  subject: string
  body_text: string
} {
  let users = 0
  let dictionaries = 0
  let invites = 0
  let other = 0
  for (const message of messages) {
    const text = message.body_text
    if (text.includes(NEW_DICTIONARY_MARKER))
      dictionaries++
    else if (text.includes(NEW_USER_MARKER))
      users++
    else if (text.includes(INVITE_MARKER))
      invites++
    else
      other++
  }
  const parts: string[] = []
  if (users)
    parts.push(`${users} new user${users === 1 ? '' : 's'}`)
  if (dictionaries)
    parts.push(`${dictionaries} new ${dictionaries === 1 ? 'dictionary' : 'dictionaries'}`)
  if (invites)
    parts.push(`${invites} new invitation${invites === 1 ? '' : 's'}`)
  if (other)
    parts.push(`${other} other notification${other === 1 ? '' : 's'}`)
  const total = messages.length
  return {
    subject: total === 1 ? '1 new notification' : `${total} new notifications`,
    body_text: natural_join(parts),
  }
}

if (import.meta.vitest) {
  describe(summarize_notifications, () => {
    it('categorizes and naturally joins a mixed batch', () => {
      const messages = [
        format_new_user_notification({ actor: 'A', email: 'a@b.com', base_url: 'https://ld.app' }),
        format_new_user_notification({ actor: 'B', email: 'b@b.com', base_url: 'https://ld.app' }),
        format_new_dictionary_notification({ dictionary_name: 'D', dictionary_id: 'd1', actor: 'A', base_url: 'https://ld.app' }),
        format_invite_notification({ actor: 'A', target_email: 't@b.com', role: 'manager', dictionary_name: 'D', dictionary_id: 'd1', base_url: 'https://ld.app' }),
      ]
      const summary = summarize_notifications({ messages })
      expect(summary.subject).toBe('4 new notifications')
      expect(summary.body_text).toBe('2 new users, 1 new dictionary, and 1 new invitation')
    })

    it('singularizes a lone dictionary and a single-item subject', () => {
      const summary = summarize_notifications({ messages: [format_new_dictionary_notification({ dictionary_name: 'D', dictionary_id: 'd1', actor: 'A', base_url: 'https://ld.app' })] })
      expect(summary.subject).toBe('1 new notification')
      expect(summary.body_text).toBe('1 new dictionary')
    })

    it('buckets unrecognized bodies as "other" so the total holds', () => {
      const summary = summarize_notifications({ messages: [{ body_text: 'something unexpected happened' }] })
      expect(summary.body_text).toBe('1 other notification')
    })

    it('markers match the live formatter output (drift guard)', () => {
      expect(format_new_user_notification({ actor: 'A', email: 'a@b.com', base_url: 'https://ld.app' }).body_text).toContain(NEW_USER_MARKER)
      expect(format_new_dictionary_notification({ dictionary_name: 'D', dictionary_id: 'd1', actor: 'A', base_url: 'https://ld.app' }).body_text).toContain(NEW_DICTIONARY_MARKER)
      expect(format_invite_notification({ actor: 'A', target_email: 't@b.com', role: 'manager', dictionary_name: 'D', dictionary_id: 'd1', base_url: 'https://ld.app' }).body_text).toContain(INVITE_MARKER)
    })
  })

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
