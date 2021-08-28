import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

// Learned from https://fireship.io/lessons/sendgrid-transactional-email-guide/
import * as sgMail from '@sendgrid/mail';
import { IInvite } from '../../../src/lib/interfaces';

const sg_api_key = functions.config().sendgrid.key;
// Set by running `firebase functions:config:set sendgrid.key="your_key"` // see https://fireship.io/lessons/sendgrid-transactional-email-guide/
// read with firebase functions:config:get
sgMail.setApiKey(sg_api_key);

import { adminRecipients } from './adminRecipients';

export default async (
  snapshot: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {
  const invite = snapshot.data() as IInvite;
  const dictionaryId = context.params.dictionaryId;
  const inviteId = context.params.inviteId;

  const roleMessage =
    invite.role === 'manager' ? 'manager' : 'contributor, which allows you to add and edit entries';
  if (invite) {
    const msg = {
      from: 'annaluisa@livingtongues.org',
      to: invite.targetEmail,
      replyTo: invite.inviterEmail,
      subject: `${invite.inviterName} has invited you to contribute to the ${invite.dictionaryName} Living Dictionary`,
      trackingSettings: {
        clickTracking: {
          enable: false,
          enableText: false,
        },
      },
      text: `Hello,

${invite.inviterName} has invited you to work on the ${invite.dictionaryName} Living Dictionary as a ${roleMessage}. If you would like to help with this dictionary, then open this link: https://livingdictionaries.app/${dictionaryId}/invite/${inviteId} to  access the dictionary.

If you have any questions for ${invite.inviterName}, send an email to ${invite.inviterEmail}

Thank you,
Living Tongues Institute for Endangered Languages

https://livingtongues.org (Living Tongues Homepage)
https://livingdictionaries.app (Living Dictionaries website)`,
    };
    const reply = await sgMail.send(msg);
    console.log(reply);

    const inviteRef = admin.firestore().doc(`dictionaries/${dictionaryId}/invites/${inviteId}`);
    await inviteRef.update({
      status: 'sent',
    });

    if (!adminRecipients.includes(invite.inviterEmail)) {
      const adminMsg = {
        from: 'jacob@livingtongues.org',
        to: adminRecipients,
        replyTo: invite.inviterEmail,
        subject: `${invite.inviterName} has invited ${invite.targetEmail} to contribute to the ${invite.dictionaryName} Living Dictionary`,
        trackingSettings: {
          clickTracking: {
            enable: false,
            enableText: false,
          },
        },
        text: `Hello Admins,

${invite.inviterName} has invited ${invite.targetEmail} to work on the ${invite.dictionaryName} Living Dictionary as a ${roleMessage}.

Dictionary URL: https://livingdictionaries.app/${dictionaryId}
            
If you have any questions for ${invite.inviterName}, just reply to this email.

Thanks,
Our automatic Firebase Cloud Function

https://livingdictionaries.app`,
      };
      const adminReply = await sgMail.send(adminMsg);
      console.log(adminReply);
    }
  }

  return { success: true };
};
