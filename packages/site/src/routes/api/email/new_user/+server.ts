
import { SEND_EMAIL_KEY } from '$env/static/private';
import { decodeToken } from '$lib/server/firebase-admin';
import { json } from '@sveltejs/kit';
import type { MailChannelsSendBody } from '../send/mail-channels.interface';
import type { RequestHandler } from './$types';
import type { IUser } from '@living-dictionaries/types';
import { getAdminRecipients } from '../admin_recipients';
import newUserWelcome from '../html/newUserWelcome';

export interface NewUserRequestBody {
  auth_token: string;
  user: IUser;
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  const { auth_token, user } = await request.json() as NewUserRequestBody

  const decodedToken = await decodeToken(auth_token)
  if (decodedToken?.uid)
    throw new Error('No user id found in token')
  if (user.email !== decodedToken.email)
    throw new Error('token email does not match user email')

  const userMsg: MailChannelsSendBody = {
    personalizations: [{ to: [{ email: user.email }] }],
    from: {
      email: 'annaluisa@livingtongues.org',
      name: 'Anna Luisa Daigneault',
    },
    subject: 'Thank you for creating a Living Dictionaries account!',
    content: [
      {
        type: 'text/html',
        value: newUserWelcome,
      },
    ],
  };

  await fetch('/api/email/send', {
    method: 'POST',
    body: JSON.stringify({ send_key: SEND_EMAIL_KEY, mailChannelsSendBody: userMsg }),
    headers: {
      'content-type': 'application/json'
    }
  });

  const adminRecipients = getAdminRecipients(decodedToken.email);
  const adminMsg: MailChannelsSendBody = {
    personalizations: [{ to: adminRecipients }],
    from: {
      email: 'annaluisa@livingtongues.org',
    },

    subject: `New Living Dictionaries user: ${user.displayName}`,
    content: [
      {
        type: 'text/plain',
        value: `Hey Admins,

${user.displayName} has just created a Living Dictionaries account, and we sent an automatic welcome email to ${user.email}

Thanks,
Our automatic Firebase Cloud Function

https://livingdictionaries.app`,
      },
    ],
  };

  await fetch('/api/email/send', {
    method: 'POST',
    body: JSON.stringify({ send_key: SEND_EMAIL_KEY, mailChannelsSendBody: adminMsg }),
    headers: {
      'content-type': 'application/json'
    }
  });

  return json('success')
}
