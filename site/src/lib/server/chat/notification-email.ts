/**
 * Build the email-notification content for a team-chat message. Pure (no DB /
 * env) so the live notify path AND the one-off preview render byte-identical
 * output. Emulates the chat UI's "who it's from" — the author name isn't part
 * of the message body, so the email shows it as a header above the body.
 */

import { linkify_html } from '$lib/utils/linkify-html'

export function escape_html(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export interface ChatNotificationEmailInput {
  author_name: string
  room_name: string
  /** TipTap-authored message HTML (trusted). */
  body_html: string
  /** Plain-text mirror, for the text/plain part. */
  body_text: string
  /** Deep link to the room in the admin. */
  link: string
  is_dm: boolean
}

export interface ChatNotificationEmail {
  subject: string
  /** Inner HTML (the outer email shell is added by the sender). */
  html: string
  text: string
}

export function build_chat_notification_email({ author_name, room_name, body_html, body_text, link, is_dm }: ChatNotificationEmailInput): ChatNotificationEmail {
  const author = escape_html(author_name)
  const room = escape_html(room_name)
  const context = is_dm ? 'New direct message' : `New message in ${room}`
  const subject = is_dm ? `${author_name} sent you a message` : `${author_name} posted in ${room_name}`

  const html = [
    `<p style="margin:0 0 14px;color:#6b7280;font-size:13px">${context}</p>`,
    `<div style="border-left:3px solid #178871;padding:2px 0 2px 14px;margin:0 0 18px">`,
    `<div style="font-weight:700;margin:0 0 4px">${author}</div>`,
    `<div style="font-size:15px;line-height:1.5;color:#1a1a1a">${linkify_html(body_html)}</div>`,
    `</div>`,
    `<p style="margin:0"><a href="${link}" style="display:inline-block;padding:9px 18px;border-radius:6px;background:#178871;color:#fff;text-decoration:none;font-weight:600">Open the chat</a></p>`,
  ].join('')

  const text = `${context}\n\n${author_name}:\n${body_text}\n\nOpen the chat: ${link}`

  return { subject, html, text }
}
