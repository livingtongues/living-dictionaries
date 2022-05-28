import * as functions from 'firebase-functions';
import { db } from '../config';

import { sesClient } from './sesClient';
import { SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { adminRecipients } from './adminRecipients';

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
    const userMsg: SendEmailCommandInput = {
      Source: 'annaluisa@livingtongues.org',
      Destination: {
        ToAddresses: [user.email],
      },
      Message: {
        Subject: {
          Charset: 'UTF-8',
          Data: 'New Living Dictionary Created',
        },
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: newDictionary(dictionary.name, dictionaryId),
          },
        },
      },
    };

    const adminMsg: SendEmailCommandInput = {
      Source: 'jacob@livingtongues.org',
      Destination: {
        ToAddresses: adminRecipients,
      },
      Message: {
        Subject: {
          Charset: 'UTF-8',
          Data: `Living Dictionary created: ${dictionary.name}`,
        },
        Body: {
          Text: {
            Charset: 'UTF-8',
            Data: notifyAdminsOnNewDictionary(dictionary, dictionaryId, user),
          },
        },
      },
    };

    try {
      const reply = await sesClient.send(new SendEmailCommand(userMsg));
      console.log('Success', reply);
      const adminReply = await sesClient.send(new SendEmailCommand(adminMsg));
      console.log('Success', adminReply);
      return { success: true };
    } catch (err) {
      console.log('Error', err);
      return { success: false };
    }
  }
  return { success: true };
};
