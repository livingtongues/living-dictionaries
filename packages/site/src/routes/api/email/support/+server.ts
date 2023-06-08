import type { RequestHandler } from './$types';
import type { Address, EmailParts } from '../send/mail-channels.interface';
import { dev } from '$app/environment';
import { SEND_EMAIL_KEY } from '$env/static/private';
import { firebaseConfig } from 'sveltefirets';

export interface SupportRequestBody {
  email: string;
  message: string;
  name: string;
  url: string;
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  const { email, message, name, url } = await request.json() as SupportRequestBody

  const emailParts: EmailParts = {
    to: getSupportMessageRecipients({ dev }),
    reply_to: { email },
    subject: 'Living Dictionaries Support Request',
    type: 'text/plain',
    body: `${message} 

Sent by ${name} (${email}) from ${url}`,
  };

  return await fetch('/api/email/send', {
    method: 'POST',
    body: JSON.stringify({ send_key: SEND_EMAIL_KEY, emailParts }),
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

  if (dev || firebaseConfig.projectId === 'talking-dictionaries-dev')
    return recipients

  return [
    ...recipients,
    { email: 'annaluisa@livingtongues.org' }
  ];
};