import { SEND_EMAIL_KEY } from '$env/static/private';
import { decodeToken, getDb } from '$lib/server/firebase-admin';
import { json } from '@sveltejs/kit';
import type { EmailParts } from '../send/mail-channels.interface';
import type { RequestHandler } from './$types';
import type { IDictionary, IUser } from '@living-dictionaries/types';
import { getAdminRecipients } from '../addresses';
import newDictionary from '../html/newDictionary';
import { notifyAdminsOnNewDictionary } from './composeMessages';

export interface NewDictionaryRequestBody {
  auth_token: string;
  dictionary: IDictionary & { id: string };
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  const { auth_token, dictionary } = await request.json() as NewDictionaryRequestBody;

  if (!dictionary.id)
    throw new Error('No dictionary id found in request');

  const decodedToken = await decodeToken(auth_token);
  if (!decodedToken?.uid)
    throw new Error('No user id found in token');
  if (dictionary.createdBy !== decodedToken.uid)
    throw new Error('CreatedBy is does not matched user id');

  const db = getDb();
  const userSnap = await db.doc(`users/${decodedToken.uid}`).get();
  const user = userSnap.data() as IUser;

  const userMsg: EmailParts = {
    to: [{ email: user.email }],
    subject: 'New Living Dictionary Created',
    type: 'text/html',
    body: newDictionary(dictionary.name, dictionary.id),
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
    subject: `Living Dictionary created: ${dictionary.name}`,
    type: 'text/plain',
    body: notifyAdminsOnNewDictionary(dictionary, user),
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