import { error, json } from '@sveltejs/kit'
import { send_email } from '../send-email'
import { render_component_to_html } from '../render-component-to-html'
import { jacobAddress, no_reply_address } from '../addresses'
import type { RequestHandler } from './$types'
import Announcement from './Announcement.svelte'
import { ResponseCodes } from '$lib/constants'
import { dev } from '$app/environment'
import { getAdminSupabaseClient } from '$lib/supabase/admin'

export const GET: RequestHandler = async () => {
  if (!dev)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, { message: 'Not allowed' })

  try {
    const admin_supabase = getAdminSupabaseClient()

    let user_emails: { email: string, last_sign_in_at: string }[] = []
    let from = 0
    const pageSize = 1000

    while (true) {
      const { data, error } = await admin_supabase
        .from('user_emails')
        .select('email, last_sign_in_at')
        .order('last_sign_in_at', { ascending: true })
        .gt('last_sign_in_at', '2025-02-01T00:00:00Z')
        // .order('email', { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) {
        throw new Error(error.message)
      }

      if (data && data.length > 0) {
        user_emails = user_emails.concat(data)
        if (data.length < pageSize) break // last page
        from += pageSize
      } else {
        break
      }
    }

    const emails = user_emails.map(({ email }) => email)
    for (const email of emails) {
      await send_email({
        from: no_reply_address, // must use a livingdictionaries.app email for domain verification and not livingdictionaries.org
        reply_to: jacobAddress,
        to: [{ email }],
        subject: '🔧 Recent Entry Loading Issues Resolved',
        type: 'text/html',
        body: render_component_to_html({ component: Announcement }),
      })
    }

    return json({ result: 'success', email_count: emails.length, user_emails })
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error with email send request: ${err.message}`)
  }
}

// Open to send: http://localhost:3041/api/email/announcement
