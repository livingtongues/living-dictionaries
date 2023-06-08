import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendEmail } from './mailChannels';
import type { EmailParts, MailChannelsSendBody } from './mail-channels.interface';
import { DKIM_PRIVATE_KEY, SEND_EMAIL_KEY } from '$env/static/private';
import { noReplyAddress } from '../addresses';

export interface SendRequestBody {
  send_key: string;
  emailParts: EmailParts;
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  try {
    const { send_key, emailParts: { to, bcc, reply_to, subject, body, type }
    } = await request.json() as SendRequestBody

    if (send_key !== SEND_EMAIL_KEY)
      throw new Error('SEND_EMAIL_KEY env variable not configured')

    const mailChannelsSendBody: MailChannelsSendBody = {
      personalizations: [{
        to,
        dkim_domain: 'livingdictionaries.app',
        dkim_selector: 'notification',
        dkim_private_key: DKIM_PRIVATE_KEY,
      }],
      from: noReplyAddress,
      subject,
      content: [{
        type,
        value: body,
      }],
    }

    if (reply_to)
      mailChannelsSendBody.reply_to = reply_to
    if (bcc)
      mailChannelsSendBody.personalizations[0].bcc = bcc

    await sendEmail(mailChannelsSendBody as MailChannelsSendBody, fetch)

    return json('success')
  }
  catch (err: any) {
    console.error(`Error with email send request: ${err.message}`)
    throw error(500, `Error with email send request: ${err.message}`)
  }
};