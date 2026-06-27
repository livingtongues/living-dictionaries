import type { Admin } from '$lib/admins'
import { ADMINS } from '$lib/admins'
import { send_email } from '$lib/email/send-email'

type NotifyChannel = 'email' | 'ntfy'

/**
 * Read an admin's chosen notification channel from shared.db. Defaults to
 * 'email' (the column default) when the row is missing; falls back to 'email'
 * on any DB error so a ping is still attempted on a real channel. Lazily
 * `import`s the server DB so this module stays importable in non-server bundles.
 */
async function resolve_channel(email: string): Promise<NotifyChannel> {
  try {
    const { get_shared_db } = await import('$lib/db/server/shared-db')
    const row = get_shared_db()
      .prepare('SELECT notify_channel FROM users WHERE email = ?')
      .get(email) as { notify_channel?: string } | undefined
    return row?.notify_channel === 'ntfy' ? 'ntfy' : 'email'
  } catch (err) {
    console.warn('notify_admins: notify_channel lookup failed, defaulting to email:', (err as Error).message)
    return 'email'
  }
}

interface EmailPingExtras {
  /** Rich inner HTML for the email body (e.g. team-chat author header + message). Falls back to `body`. */
  email_html?: string
  /** Plain-text mirror for the email. Falls back to `body` (+ link). */
  email_text?: string
  /** Email-specific subject. Falls back to `subject`. */
  email_subject?: string
}

async function send_ping_email({ admin, subject, body, link, email_html, email_text, email_subject }: { admin: Admin } & NotifyAdminsParams & EmailPingExtras): Promise<void> {
  const shell = (inner: string) => `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a">${inner}</div>`
  const link_html = link
    ? `<p style="margin:16px 0 0"><a href="${link}" style="display:inline-block;padding:8px 16px;border-radius:6px;background:#178871;color:#fff;text-decoration:none;font-weight:600">Open in the admin</a></p>`
    : ''
  const html = shell(email_html ?? `<p style="margin:0">${body}</p>${link_html}`)
  const text = email_text ?? (link ? `${body}\n\n${link}` : body)
  try {
    await send_email({
      to: [{ email: admin.email, name: admin.name }],
      subject: email_subject ?? subject,
      body: { html, text },
    })
  } catch (err) {
    console.warn(`notify_admins: email ping to ${admin.email} failed (non-fatal):`, (err as Error).message)
  }
}

/**
 * Fire-and-forget push notification to every admin's phone via ntfy.sh.
 *
 * Each admin has their own random `ntfy_topic` in `$lib/admins.ts` so they
 * can subscribe on their phone independently. This function POSTs to every
 * admin's topic in parallel — wrapped in `Promise.allSettled` so one slow
 * or failing ntfy call never breaks delivery for the rest. ntfy outages
 * should never fail the inbound endpoint.
 *
 * Callers should still `void`-await this — it returns a settled-array
 * promise that resolves quickly (concurrent fetches), but you don't want
 * to block the inbound HTTP response on it.
 *
 * For local dev / tests, set `NTFY_DISABLED=1` to skip all pushes.
 */

export interface NotifyAdminsParams {
  /** Short subject line shown as the notification title. */
  subject: string
  /** First line of the body (≤ 200 chars recommended). */
  body: string
  /** Tap-target URL (e.g. the thread page on the admin app). */
  link?: string
}

export async function notify_admins({ subject, body, link }: NotifyAdminsParams): Promise<void> {
  // Off-duty admins (`notify: false`) keep access but aren't broadcast-pinged.
  const on_duty = ADMINS.filter(admin => admin.notify !== false)
  if (process.env.NTFY_DISABLED === '1' || on_duty.length === 0)
    return

  await Promise.allSettled(
    on_duty.map(admin => notify_one({
      topic: admin.ntfy_topic,
      subject,
      body,
      link,
    })),
  )
}

/**
 * Notify a single admin by email — used for TARGETED pings (thread assignment,
 * Team chat) so only the responsible admin is reached, not the whole team.
 * Honors the admin's chosen `notify_channel`: 'ntfy' push or 'email'.
 *
 * Silently no-ops when `email` isn't in the admin allow-list. Caller doesn't
 * need to pre-filter; safe to call with any user_id-derived email.
 */
export async function notify_admin({ email, subject, body, link, email_html, email_text, email_subject }: { email: string | null | undefined } & NotifyAdminsParams & EmailPingExtras): Promise<void> {
  if (process.env.NTFY_DISABLED === '1' || !email)
    return
  const admin = ADMINS.find(a => a.email === email)
  if (!admin)
    return
  const channel = await resolve_channel(admin.email)
  if (channel === 'ntfy')
    await notify_one({ topic: admin.ntfy_topic, subject, body, link })
  else
    await send_ping_email({ admin, subject, body, link, email_html, email_text, email_subject })
}

async function notify_one({ topic, subject, body, link }: { topic: string } & NotifyAdminsParams): Promise<void> {
  const headers: Record<string, string> = { Title: subject }
  if (link)
    headers.Click = link
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers,
      body: body.slice(0, 200),
    })
  } catch (err) {
    console.warn(`notify_admins: ntfy POST to ${topic} failed (non-fatal):`, (err as Error).message)
  }
}
