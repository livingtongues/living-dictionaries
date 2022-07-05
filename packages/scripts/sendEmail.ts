import fetch from 'node-fetch';
import type { MailChannelsSendBody } from '../functions/src/email/mail-channels.interface';

const emailData: MailChannelsSendBody = {
  personalizations: [{ to: [{ email: '...@gmail.com' }] }],
  reply_to: { email: '...@gmail.com' },
  from: {
    email: '...@livingtongues.org',
  },
  subject: 'Email send test',
  content: [
    // {
    //   type: 'text/html',
    //   value: html('FooDictionary', '12345'),
    // },
    {
      type: 'text/plain',
      value:
        'This is another test of the MailChannels implementation.',
    },
  ],
};

export async function sendEmail(emailData: MailChannelsSendBody) {
  const response = await fetch('https://mail.peoples.workers.dev/', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': '...'
    },
    body: JSON.stringify(emailData),
  });

  console.log(response.status);
  console.log(await response.text());
}

sendEmail(emailData);
