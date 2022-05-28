import * as functions from 'firebase-functions';

import { sesClient } from './sesClient';
import { SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { adminRecipients } from './adminRecipients';
import newUserWelcome from './html/newUserWelcome';

export default async (
  snapshot: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {
  const user = snapshot.data();
  try {
    if (user) {
      const userMsg: SendEmailCommandInput = {
        Source: 'annaluisa@livingtongues.org',
        Destination: {
          ToAddresses: [user.email],
        },
        Message: {
          Subject: {
            Charset: 'UTF-8',
            Data: 'Thank you for creating a Living Dictionaries account!',
          },
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: newUserWelcome,
            },
          },
        },
      };
      const reply = await sesClient.send(new SendEmailCommand(userMsg));
      console.log(reply);

      const adminMsg: SendEmailCommandInput = {
        Source: 'jacob@livingtongues.org',
        Destination: {
          ToAddresses: adminRecipients,
        },
        Message: {
          Subject: {
            Charset: 'UTF-8',
            Data: `New Living Dictionaries user: ${user.displayName}`,
          },
          Body: {
            Text: {
              Charset: 'UTF-8',
              Data: `Hey Admins,

${user.displayName} has just created a Living Dictionaries account, and we sent an automatic welcome email to ${user.email}

Thanks,
Our automatic Firebase Cloud Function

https://livingdictionaries.app`,
            },
          },
        },
      };
      const adminReply = await sesClient.send(new SendEmailCommand(adminMsg));
      console.log(adminReply);
    }

    return { success: true };
  } catch (err) {
    console.log('Error', err);
    return { success: false };
  }
};
