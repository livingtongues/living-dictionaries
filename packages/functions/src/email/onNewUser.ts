import * as functions from 'firebase-functions';

// Learned from https://fireship.io/lessons/sendgrid-transactional-email-guide/
import * as sgMail from '@sendgrid/mail';
const sg_api_key = functions.config().sendgrid.key;
// Set by running `firebase functions:config:set sendgrid.key="your_key"` // see https://fireship.io/lessons/sendgrid-transactional-email-guide/
// read with firebase functions:config:get
sgMail.setApiKey(sg_api_key);

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
    const reply = await sgMail.send(msg);
    console.log(reply);

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
    const adminReply = await sgMail.send(adminMsg);
    console.log(adminReply);
  }
  return { success: true };
};
