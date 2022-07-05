import * as functions from 'firebase-functions';

import { adminRecipients } from './recipients';
import { MailChannelsSendBody } from './mail-channels.interface';
import { sendEmail } from './mailChannels';

import newUserWelcome from './html/newUserWelcome';

export default async (
  snapshot: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {
  const user = snapshot.data();
  try {
    if (user) {
      const userMsg: MailChannelsSendBody = {
        personalizations: [{ to: [{ email: user.email }] }],
        from: {
          email: 'diego@livingtongues.org',
          // name: 'Anna Luisa Daigneault',
        },
        subject: 'Thank you for creating a Living Dictionaries account!',
        content: [
          {
            type: 'text/html',
            value: newUserWelcome,
          },
        ],
      };
      const reply = await sendEmail(userMsg);
      console.log(reply);

      const adminMsg: MailChannelsSendBody = {
        personalizations: [{ to: adminRecipients }],
        from: {
          email: 'jacob@livingtongues.org',
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
      const adminReply = await sendEmail(adminMsg);
      console.log(adminReply);
    }

    return { success: true };
  } catch (err) {
    console.log('Error', err);
    return { success: false };
  }
};
