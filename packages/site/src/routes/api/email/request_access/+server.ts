import type { RequestHandler } from './$types';
import type { Address, EmailParts } from '../send/mail-channels.interface';
import { dev } from '$app/environment';
import { SEND_EMAIL_KEY } from '$env/static/private';
import { getSupportMessageRecipients } from '../addresses';
import type { IHelper, IUser } from '@living-dictionaries/types';
import { getDb } from '$lib/server/firebase-admin';
import { post_request } from '$lib/helpers/get-post-requests';
import { error, json } from '@sveltejs/kit';
import { ResponseCodes } from '$lib/constants';
import type { SendRequestBody } from '$api/email/send/+server';

export interface RequestAccessBody {
  email: string;
  message: string;
  name: string;
  url: string;
  dictionaryId: string;
  dictionaryName: string;
}

async function getManagerAddresses(dictionaryId: string): Promise<Address[]> {
  const db = getDb()
  const managers = (await db.collection(`dictionaries/${dictionaryId}/managers`).get()).docs.map(doc => doc.data() as IHelper)
  const userPromises = managers.map(manager => {
    return db.doc(`users/${manager.id}`).get();
  });
  const users = (await Promise.all(userPromises)).map(doc => doc.data() as IUser)
  return users.map(user => {
    return {
      name: user.displayName,
      email: user.email
    }
  })
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  const { email, message, name, url, dictionaryId, dictionaryName } = await request.json() as RequestAccessBody;
  const managerAddresses = await getManagerAddresses(dictionaryId)
  const emailParts: EmailParts = {
    to: [...getSupportMessageRecipients({ dev }), ...managerAddresses],
    reply_to: { email },
    subject: `${dictionaryName} Living Dictionary: ${email} requests editing access`,
    type: 'text/plain',
    body: `${message} 

Sent by ${name} (${email}) from ${url}`,
  };

  const { error: email_send_error } = await post_request<SendRequestBody, null>('/api/email/send', { send_key: SEND_EMAIL_KEY, emailParts }, { fetch });

  if (email_send_error)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, email_send_error)

  return json('success')
};
