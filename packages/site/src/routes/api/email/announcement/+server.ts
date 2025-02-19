import { error, json } from '@sveltejs/kit'
import { send_email } from '../send-email'
import { render_component_to_html } from '../render-component-to-html'
import { jacobAddress, no_reply_address } from '../addresses'
import type { RequestHandler } from './$types'
import MigrationClosure from './MigrationClosure.svelte'
import { ResponseCodes } from '$lib/constants'
import { dev } from '$app/environment'

const batchSize = 50

export const GET: RequestHandler = async () => {
  if (!dev)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, { message: 'Not allowed' })

  try {
    // const user_emails = users.map(user => ({ email: user.email }))
    const user_emails = [] // TODO: get from supabase next time using 'user_emails' view

    // return json({ emails_to_send: users.map(user => user.email).splice(received) })

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
        subject: '🔧 Service Announcement: Editing Ability Paused for 24 Hours Next Week',
        type: 'text/html',
        body: render_component_to_html({ component: MigrationClosure }),
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
