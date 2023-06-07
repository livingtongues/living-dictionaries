import { FirestoreEvent, QueryDocumentSnapshot } from 'firebase-functions/v2/firestore';
import { db } from '../config';

import { adminRecipients } from './recipients';
import { MailChannelsSendBody } from './mail-channels.interface';
import { sendEmail } from './mailChannels';

import { IDictionary, IUser } from '@living-dictionaries/types';

import { notifyAdminsOnNewDictionary } from './composeMessages';
import newDictionary from './html/newDictionary';

export async function onNewDictionary({ data, params }: FirestoreEvent<QueryDocumentSnapshot, { dictionaryId: string }>) {
  const dictionary = data.data() as IDictionary;
  const dictionaryId = params.dictionaryId;

  const userSnap = await db.doc(`users/${dictionary && dictionary.createdBy}`).get();
  const user = userSnap.data() as IUser;

  if (dictionary && user?.email) {
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
          value: newDictionary(dictionary.name, dictionaryId),
        },
      ],
    };

    const adminMsg: MailChannelsSendBody = {
      personalizations: [{ to: adminRecipients }],
      from: {
        email: 'annaluisa@livingtongues.org',
      },
      subject: `Living Dictionary created: ${dictionary.name}`,
      content: [
        {
          type: 'text/plain',
          value: notifyAdminsOnNewDictionary(dictionary, dictionaryId, user),
        },
      ],
    };

    try {
      const reply = await sendEmail(userMsg);
      console.log('Success', reply);
      const adminReply = await sendEmail(adminMsg);
      console.log('Success', adminReply);
      return { success: true };
    } catch (err) {
      console.log('Error', err);
      return { success: false };
    }
  }
  return { success: true };
};
