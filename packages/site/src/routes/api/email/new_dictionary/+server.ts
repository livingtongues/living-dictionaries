import { SEND_EMAIL_KEY } from '$env/static/private';
import { decodeToken, getDb } from '$lib/server/firebase-admin';
import { json } from '@sveltejs/kit';
import type { MailChannelsSendBody } from '../send/mail-channels.interface';
import type { RequestHandler } from './$types';
import type { IDictionary, IUser } from '@living-dictionaries/types';
import { getAdminRecipients } from '../admin_recipients';
import newDictionary from '../html/newDictionary';
import { notifyAdminsOnNewDictionary } from './composeMessages';

export interface NewDictionaryRequestBody {
  auth_token: string;
  dictionary: IDictionary;
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  const { auth_token, dictionary } = await request.json() as NewDictionaryRequestBody

  if (!dictionary.id)
    throw new Error('No dictionary id found in request')

  const decodedToken = await decodeToken(auth_token)
  if (decodedToken?.uid)
    throw new Error('No user id found in token')
  if (dictionary.createdBy !== decodedToken.uid)
    throw new Error('CreatedBy is does not matched user id')

  const db = getDb()
  const userSnap = await db.doc(`users/${decodedToken.uid}`).get()
  const user = userSnap.data() as IUser;

  const userMsg: MailChannelsSendBody = {
    personalizations: [{ to: [{ email: user.email }] }],
    from: {
      email: 'annaluisa@livingtongues.org',
      name: 'Anna Luisa Daigneault',
    },
    subject: 'New Living Dictionary Created',
    content: [
      {
        type: 'text/html',
        value: newDictionary(dictionary.name, dictionary.id),
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
    subject: `Living Dictionary created: ${dictionary.name}`,
    content: [
      {
        type: 'text/plain',
        value: notifyAdminsOnNewDictionary(dictionary, user),
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
};