import * as functions from 'firebase-functions';
import { db } from '../config';

import { sesClient } from './sesClient';
import { SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { adminRecipients } from './adminRecipients';

export default async (
  snapshot: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {
  const user = snapshot.data();

  if (user) {
    const msg = {
      from: 'annaluisa@livingtongues.org',
      to: user.email,
      templateId: 'd-7f80bcac817b46b7852caedd55786cce', // "Automatic Welcome"
      dynamic_template_data: {
        subject: 'Thank you for creating an account!',
        // name: user.displayName,
      },
    };
    // const reply = await sgMail.send(msg);
    // console.log(reply);

    const adminMsg = {
      from: 'jacob@livingtongues.org',
      to: adminRecipients,
      subject: `New Living Dictionaries user: ${user.displayName}`,
      trackingSettings: {
        clickTracking: {
          enable: false,
          enableText: false,
        },
      },
      text: `Hey Admins,
    
    ${user.displayName} has just created a Living Dictionaries account, and we sent an automatic welcome email to ${user.email}
    
    Thanks,
    Our automatic Firebase Cloud Function
    
    https://livingdictionaries.app`,
    };
    // const adminReply = await sgMail.send(adminMsg);
    // console.log(adminReply);
  }
  return { success: true };
};
