import type { RequestHandler } from './$types';
import type { EmailParts } from '../send/mail-channels.interface';
import { dev } from '$app/environment';
import { SEND_EMAIL_KEY } from '$env/static/private';
import { getSupportMessageRecipients } from '../addresses';
import { error, json } from '@sveltejs/kit';
import { ResponseCodes } from '$lib/constants';
import { post_request } from '$lib/helpers/get-post-requests';
import type { SendRequestBody } from '$api/email/send/+server';

export interface SupportRequestBody {
  email: string;
  message: string;
  name: string;
  url: string;
  subject?: string;
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  const { email, message, name, url, subject } = await request.json() as SupportRequestBody;
  const emailParts: EmailParts = {
    to: getSupportMessageRecipients({ dev }),
    reply_to: { email },
    subject: subject || 'Living Dictionaries Support Request',
    type: 'text/plain',
    body: `${message} 

Sent by ${name} (${email}) from ${url}`,
  };

  const { error: email_send_error } = await post_request<SendRequestBody, null>('/api/email/send', { send_key: SEND_EMAIL_KEY, emailParts }, { fetch });

  if (email_send_error)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, email_send_error)

  return json('success')
};
