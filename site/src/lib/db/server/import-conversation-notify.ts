/**
 * Who gets told when someone posts in an import conversation
 * (`.issues/import-conversations.md`). Email and ntfy are DOORBELLS — the whole
 * record lives on `/{dict}/import/{thread_id}` and both sides write there.
 *
 * Fan-out for a post by `author_user_id`:
 *   - manager-side participants (requester + anyone who has posted) get a short
 *     chat-style email with an "Open the conversation" button, at most once per
 *     unread batch (skip if `last_notified_at > last_read_at`)
 *   - the assigned admin gets an immediate direct ping on their chosen channel
 *   - every other admin gets a System notice in the Notifications room, deduped
 *     by `activity_batch` so a burst of posts produces ONE notice; the 8am
 *     digest rolls it up
 *
 * Fire-and-forget from the endpoints (`void notify_conversation_activity(...)`).
 */
import type { Database } from 'better-sqlite3'
import type { ConversationRow } from './import-conversations'
import { randomUUID } from 'node:crypto'
import { is_admin } from '$lib/admins'
import { support_address } from '$lib/email/addresses'
import { send_raw_email } from '$lib/email/send-raw-email'
import { notify_admin } from '$lib/notifications/notify-admins'
import { escape_html } from '$lib/server/chat/notification-email'
import { format_import_conversation_notification } from '$lib/server/chat/notification-messages'
import { post_system_notification } from '$lib/server/chat/system-notifier'
import { log_server_event } from '$lib/server/log-server-event'
import { set_message_rfc_id } from './import-conversations'

/** Trimmed one-line preview used in every channel. */
export function summarize_body(body_text: string, max = 140): string {
  const flat = body_text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

interface ParticipantRow {
  user_id: string
  email: string | null
  name: string | null
  last_read_at: string | null
  last_notified_at: string | null
}

/**
 * One ping per unread batch, mirroring the chat policy: if we've already pinged
 * since they last read the conversation, stay quiet until they come look.
 */
export function should_notify_participant(participant: Pick<ParticipantRow, 'last_read_at' | 'last_notified_at'>): boolean {
  if (!participant.last_notified_at)
    return true
  if (!participant.last_read_at)
    return false
  return participant.last_read_at > participant.last_notified_at
}

function build_manager_email({ author_name, dictionary_name, summary, link }: {
  author_name: string
  dictionary_name: string
  summary: string
  link: string
}): { subject: string, html: string, text: string } {
  const subject = `New message about your ${dictionary_name} import`
  const html = [
    `<p style="margin:0 0 14px;color:#6b7280;font-size:13px">New message in your import conversation for ${escape_html(dictionary_name)}</p>`,
    `<div style="border-left:3px solid #178871;padding:2px 0 2px 14px;margin:0 0 18px">`,
    `<div style="font-weight:700;margin:0 0 4px">${escape_html(author_name)}</div>`,
    `<div style="font-size:15px;line-height:1.5;color:#1a1a1a">${escape_html(summary)}</div>`,
    `</div>`,
    `<p style="margin:0 0 16px"><a href="${escape_html(link)}" style="display:inline-block;padding:9px 18px;border-radius:6px;background:#178871;color:#fff;text-decoration:none;font-weight:600">Open the conversation</a></p>`,
    `<p style="margin:0;color:#6b7280;font-size:13px">Please answer on the site rather than by email, so your reply is saved with your dictionary for good.</p>`,
  ].join('')
  const text = `New message in your import conversation for ${dictionary_name}\n\n${author_name}:\n${summary}\n\nOpen the conversation: ${link}\n\nPlease answer on the site rather than by email, so your reply is saved with your dictionary for good.`
  return { subject, html, text }
}

export function conversation_link({ base_url, dictionary_url, thread_id }: {
  base_url: string
  dictionary_url: string
  thread_id: string
}): string {
  return `${base_url}/${dictionary_url}/import/${thread_id}`
}

export async function notify_conversation_activity({ db, conversation, dictionary_name, dictionary_url, author_user_id, message_row_id, body_text, base_url, now = new Date().toISOString() }: {
  db: Database
  conversation: ConversationRow
  dictionary_name: string
  dictionary_url: string
  author_user_id: string | null
  /** The `messages` row just written — gets stamped with the outbound RFC Message-ID. */
  message_row_id: string
  body_text: string
  base_url: string
  now?: string
}): Promise<void> {
  const summary = summarize_body(body_text)
  const link = conversation_link({ base_url, dictionary_url, thread_id: conversation.id })
  const author = author_user_id
    ? db.prepare('SELECT name, email FROM users WHERE id = ?').get(author_user_id) as { name: string | null, email: string | null } | undefined
    : undefined
  const author_name = author?.name || author?.email || 'Living Dictionaries'
  const author_is_admin = is_admin(author?.email)

  try {
    await notify_manager_participants({ db, conversation, dictionary_name, dictionary_url, author_user_id, author_name, message_row_id, summary, base_url, now })
  } catch (err) {
    log_server_event({ level: 'error', message: 'import_conversation_manager_notify_failed', error: err as Error, context: { thread_id: conversation.id } })
  }

  // Only a manager-side post needs to reach the team.
  if (author_is_admin)
    return

  if (conversation.assigned_to_user_id && conversation.assigned_to_user_id !== author_user_id) {
    const assignee = db.prepare('SELECT email FROM users WHERE id = ?').get(conversation.assigned_to_user_id) as { email: string | null } | undefined
    void notify_admin({
      email: assignee?.email,
      subject: `Import conversation: ${dictionary_name}`,
      body: `${author_name}: ${summary}`,
      link,
    })
  }

  post_system_notification({
    db,
    content: format_import_conversation_notification({
      actor: author_name,
      actor_user_id: author_user_id,
      dictionary_name,
      dictionary_url,
      thread_id: conversation.id,
      summary,
      base_url,
    }),
    // The dedupe: one notice per conversation per unread batch. `activity_batch`
    // advances when a team member opens the conversation, so the next post after
    // that gets a fresh id and posts again.
    client_message_id: `import-activity:${conversation.id}:${conversation.activity_batch ?? 0}`,
  })
}

async function notify_manager_participants({ db, conversation, dictionary_name, dictionary_url, author_user_id, author_name, message_row_id, summary, base_url, now }: {
  db: Database
  conversation: ConversationRow
  dictionary_name: string
  dictionary_url: string
  author_user_id: string | null
  author_name: string
  message_row_id: string
  summary: string
  base_url: string
  now: string
}): Promise<void> {
  const participants = db.prepare(`
    SELECT p.user_id, p.last_read_at, p.last_notified_at, u.email, u.name
    FROM thread_participants p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.thread_id = ? AND p.side = 'manager' AND p.user_id IS NOT ?
  `).all(conversation.id, author_user_id) as ParticipantRow[]

  const targets = participants.filter(participant => participant.email && should_notify_participant(participant))
  if (!targets.length)
    return

  const link = conversation_link({ base_url, dictionary_url, thread_id: conversation.id })
  const email = build_manager_email({ author_name, dictionary_name, summary, link })
  // Recorded on the message row so a stray inbox reply threads straight back
  // into this conversation via find_or_create_thread's References match.
  const rfc_message_id = `<${randomUUID()}@livingdictionaries.app>`
  const prior = db.prepare('SELECT message_id FROM messages WHERE thread_id = ? AND message_id IS NOT NULL ORDER BY created_at')
    .all(conversation.id) as { message_id: string }[]
  const references = prior.map(row => row.message_id)

  const stamp = db.prepare('UPDATE thread_participants SET last_notified_at = ? WHERE thread_id = ? AND user_id = ?')
  let sent = false
  for (const target of targets) {
    try {
      await send_raw_email({
        to: { email: target.email as string, name: target.name ?? undefined },
        reply_to: support_address,
        subject: email.subject,
        text_body: email.text,
        html_body: email.html,
        message_id: rfc_message_id,
        in_reply_to: references.length ? references[references.length - 1] : null,
        references,
        auto_submitted: 'auto-generated',
      })
      sent = true
    } catch (err) {
      log_server_event({ level: 'warn', message: 'import_conversation_email_failed', error: err as Error, context: { thread_id: conversation.id, user_id: target.user_id } })
      continue
    }
    stamp.run(now, conversation.id, target.user_id)
  }
  if (sent)
    set_message_rfc_id({ db, message_row_id, message_id: rfc_message_id })
}

if (import.meta.vitest) {
  describe(should_notify_participant, () => {
    test('pings a participant who has never been pinged', () => {
      expect(should_notify_participant({ last_read_at: null, last_notified_at: null })).toBe(true)
      expect(should_notify_participant({ last_read_at: '2026-07-25T00:00:00Z', last_notified_at: null })).toBe(true)
    })

    test('stays quiet until they have come and looked', () => {
      expect(should_notify_participant({ last_read_at: null, last_notified_at: '2026-07-25T01:00:00Z' })).toBe(false)
      expect(should_notify_participant({ last_read_at: '2026-07-25T00:00:00Z', last_notified_at: '2026-07-25T01:00:00Z' })).toBe(false)
    })

    test('re-arms once they read past the last ping', () => {
      expect(should_notify_participant({ last_read_at: '2026-07-25T02:00:00Z', last_notified_at: '2026-07-25T01:00:00Z' })).toBe(true)
    })
  })

  describe(summarize_body, () => {
    test('flattens whitespace and truncates with an ellipsis', () => {
      expect(summarize_body('hello\n\n  there')).toBe('hello there')
      expect(summarize_body('abcdefghij', 5)).toBe('abcd…')
      expect(summarize_body('abcde', 5)).toBe('abcde')
    })
  })
}
