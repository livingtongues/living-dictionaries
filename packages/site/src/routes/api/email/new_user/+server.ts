
import { SEND_EMAIL_KEY } from '$env/static/private';
import { decodeToken } from '$lib/server/firebase-admin';
import { json } from '@sveltejs/kit';
import type { EmailParts } from '../send/mail-channels.interface';
import type { RequestHandler } from './$types';
import type { IUser } from '@living-dictionaries/types';
import { getAdminRecipients } from '../addresses';
import newUserWelcome from '../html/newUserWelcome';

export interface NewUserRequestBody {
  auth_token: string;
  user: IUser;
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  const { auth_token, user } = await request.json() as NewUserRequestBody;

  const decodedToken = await decodeToken(auth_token);
  if (!decodedToken?.uid)
    throw new Error('No user id found in token');
  if (user.email !== decodedToken.email)
    throw new Error('token email does not match user email');

  const userMsg: EmailParts = {
    to: [{ email: user.email }],
    subject: 'Thank you for creating a Living Dictionaries account!',
    type: 'text/html',
    body: newUserWelcome,
  };

  await fetch('/api/email/send', {
    method: 'POST',
    body: JSON.stringify({ send_key: SEND_EMAIL_KEY, emailParts: userMsg }),
    headers: {
      'content-type': 'application/json'
    }
  });

  const adminRecipients = getAdminRecipients(decodedToken.email);
  const adminMsg: EmailParts = {
    to: adminRecipients,
    subject: `New Living Dictionaries user: ${user.displayName}`,
    type: 'text/plain',
    body: `Hey Admins,

${user.displayName} has just created a Living Dictionaries account, and we sent an automatic welcome email to ${user.email}

Thanks,
Our automatic Vercel Function

https://livingdictionaries.app`,
  };

  await fetch('/api/email/send', {
    method: 'POST',
    body: JSON.stringify({ send_key: SEND_EMAIL_KEY, emailParts: adminMsg }),
    headers: {
      'content-type': 'application/json'
    }
  });

  return json('success');
};
