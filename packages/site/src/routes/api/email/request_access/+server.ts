import type { RequestHandler } from './$types';
import type { Address, EmailParts } from '../send/mail-channels.interface';
import { dev } from '$app/environment';
import { SEND_EMAIL_KEY } from '$env/static/private';
import { getSupportMessageRecipients } from '../addresses';
import type { IHelper, IUser } from '@living-dictionaries/types';
import { getDb } from '$lib/server/firebase-admin';

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

  return await fetch('/api/email/send', {
    method: 'POST',
    body: JSON.stringify({ send_key: SEND_EMAIL_KEY, emailParts }),
    headers: {
      'content-type': 'application/json'
    }
  });
};
