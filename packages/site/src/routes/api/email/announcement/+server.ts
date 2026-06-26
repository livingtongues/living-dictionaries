import { error, json } from '@sveltejs/kit'
import { send_email } from '../send-email'
import { render_component_to_html } from '../render-component-to-html'
import { jacobAddress, no_reply_address } from '../addresses'
import type { RequestHandler } from './$types'
import Announcement from './Announcement.svelte'
import { ResponseCodes } from '$lib/constants'
import { dev } from '$app/environment'
import { getAdminSupabaseClient } from '$lib/supabase/admin'

const batchSize = 50

export const GET: RequestHandler = async () => {
  if (!dev)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, { message: 'Not allowed' })

  try {
    const admin_supabase = getAdminSupabaseClient()

    let user_emails: { email: string }[] = []
    let from = 0
    const pageSize = 1000

    while (true) {
      const { data, error } = await admin_supabase
        .from('user_emails')
        .select('email')
        .order('email', { ascending: true })
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

    const email_batches: { email: string }[][] = []
    for (let i = 0; i < user_emails.length; i += batchSize) {
      email_batches.push(user_emails.slice(i, i + batchSize))
    }

    for (let index = 0; index < email_batches.length; index++) {
      const email_batch = email_batches[index]
      console.info({ index, emails: email_batch.map(({ email }) => email) })

      await send_email({
        from: no_reply_address, // must use a livingdictionaries.app email for domain verification and not livingdictionaries.org
        reply_to: jacobAddress,
        to: [jacobAddress],
        bcc: email_batch,
        subject: '🔧 Recent Entry Loading Issues Resolved',
        type: 'text/html',
        body: render_component_to_html({ component: Announcement }),
      })
      console.info('sent batch')
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    return json({ result: 'success', email_count: user_emails.length, email_batches })
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error with email send request: ${err.message}`)
  }
}

// Open to send: http://localhost:3041/api/email/announcement
