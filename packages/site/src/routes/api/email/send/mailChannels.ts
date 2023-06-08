import { MAILCHANNELS_WORKER_KEY } from '$env/static/private';
import type { MailChannelsSendBody } from './mail-channels.interface';

const cloudflareEmailEndpoint = 'https://send.livingdictionaries.workers.dev/';

export async function sendEmail(emailData: MailChannelsSendBody, _fetch: typeof fetch) {
  if (!MAILCHANNELS_WORKER_KEY)
    throw new Error('EMAIL_KEY env variable not configured')

  console.log({ sendingTo: emailData.personalizations[0].to, body: emailData.content[0].value })

  const response = await _fetch(cloudflareEmailEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': MAILCHANNELS_WORKER_KEY
    },
    body: JSON.stringify(emailData),
  });

  // receives status 202 from MailChannels to indicate send pending
  if (!response.status.toString().startsWith('2'))
    throw new Error(`MailChannels workers error: ${response.status} ${response.statusText}`);
}