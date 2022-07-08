import * as functions from 'firebase-functions';
import { db } from '../config';

import { adminRecipients } from './recipients';
import { MailChannelsSendBody } from './mail-channels.interface';
import { sendEmail } from './mailChannels';

import { IDictionary, IUser } from '@living-dictionaries/types';

import { notifyAdminsOnNewDictionary } from './composeMessages';
import newDictionary from './html/newDictionary';

export default async (
  snapshot: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {
  const dictionary = snapshot.data() as IDictionary;
  const dictionaryId = context.params.dictionaryId;

  const userSnap = await db.doc(`users/${dictionary && dictionary.createdBy}`).get();
  const user = userSnap.data() as IUser;

  if (dictionary && user?.email) {
    const userMsg: MailChannelsSendBody = {
      personalizations: [{ to: [{ email: user.email }] }],
      from: {
        email: 'diego@livingtongues.org',
        // name: 'Anna Luisa Daigneault',
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
        email: 'jacob@livingtongues.org',
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
