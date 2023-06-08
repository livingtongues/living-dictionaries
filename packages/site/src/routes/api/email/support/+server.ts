import type { RequestHandler } from './$types';
import type { Address, MailChannelsSendBody } from '../send/mail-channels.interface';
import { dev } from '$app/environment';
import { SEND_EMAIL_KEY } from '$env/static/private';

export interface SupportRequestBody {
  email: string;
  message: string;
  name: string;
  url: string;
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  const { email, message, name, url } = await request.json() as SupportRequestBody

  const mailChannelsSendBody: MailChannelsSendBody = {
    personalizations: [{ to: getSupportMessageRecipients({ dev }) }],
    from: { email: 'annaluisa@livingtongues.org' },
    reply_to: { email },
    subject: 'Living Dictionaries Support Request',
    content: [
      {
        type: 'text/plain',
        value: `${message} 

        Sent by ${name} (${email}) from ${url}`,
      },
    ],
  };

  return await fetch('/api/email/send', {
    method: 'POST',
    body: JSON.stringify({ send_key: SEND_EMAIL_KEY, mailChannelsSendBody }),
    headers: {
      'content-type': 'application/json'
    }
  });
};

function getSupportMessageRecipients({ dev }: { dev: boolean }): Address[] {
  const recipients: Address[] = [
    { email: 'jacob@livingtongues.org' },
    { email: 'diego@livingtongues.org' },
  ]

  if (!dev) {
    recipients.push({ email: 'annaluisa@livingtongues.org' });
  }

  return recipients;
};