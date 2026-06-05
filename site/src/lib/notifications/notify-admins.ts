import { ADMINS } from '$lib/admins'

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
  if (process.env.NTFY_DISABLED === '1' || ADMINS.length === 0)
    return

  await Promise.allSettled(
    ADMINS.map(admin => notify_one({
      topic: admin.ntfy_topic,
      subject,
      body,
      link,
    })),
  )
}

/**
 * Push to a single admin by email — used for thread-assignment pings so only
 * the responsible admin's phone buzzes (not the whole team).
 *
 * Silently no-ops when `email` isn't in the admin allow-list. Caller doesn't
 * need to pre-filter; safe to call with any user_id-derived email.
 */
export async function notify_admin({ email, subject, body, link }: { email: string | null | undefined } & NotifyAdminsParams): Promise<void> {
  if (process.env.NTFY_DISABLED === '1' || !email)
    return
  const admin = ADMINS.find(a => a.email === email)
  if (!admin)
    return
  await notify_one({ topic: admin.ntfy_topic, subject, body, link })
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
