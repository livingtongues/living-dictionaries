import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendEmail } from './mailChannels';
import type { MailChannelsSendBody } from './mail-channels.interface';
import { SEND_EMAIL_KEY } from '$env/static/private';

export const POST: RequestHandler = async ({ request, fetch }) => {
  try {
    const { send_key, mailChannelsSendBody } = await request.json()

    if (send_key !== SEND_EMAIL_KEY)
      throw new Error('SEND_EMAIL_KEY env variable not configured')

    await sendEmail(mailChannelsSendBody as MailChannelsSendBody, fetch)

    return json('success')
  }
  catch (err: any) {
    console.error(`Error with email send request: ${err.message}`)
    throw error(500, `Error with email send request: ${err.message}`)
  }
};