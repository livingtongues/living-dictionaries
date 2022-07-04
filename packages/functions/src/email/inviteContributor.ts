import * as functions from 'firebase-functions';
import { db } from '../config';

import { adminRecipients } from './recipients';
import { MailChannelsSendBody } from './mail-channels.interface';
import { sendEmail } from './mailChannels';

import { IInvite } from '@living-dictionaries/types';

export default async (
  snapshot: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {
  const invite = snapshot.data() as IInvite;
  const dictionaryId = context.params.dictionaryId;
  const inviteId = context.params.inviteId;

  try {
    if (invite) {
      const roleMessage =
        invite.role === 'manager'
          ? 'manager'
          : 'contributor, which allows you to add and edit entries';

      const userMsg: MailChannelsSendBody = {
        personalizations: [{ to: [{ email: invite.targetEmail }] }],
        from: {
          email: 'annaluisa@livingtongues.org',
          name: 'Anna Luisa Daigneault',
        },
        reply_to: { email: invite.inviterEmail },
        subject: `${invite.inviterName} has invited you to contribute to the ${invite.dictionaryName} Living Dictionary`,
        content: [
          {
            type: 'text/plain',
            value: `Hello,

${invite.inviterName} has invited you to work on the ${invite.dictionaryName} Living Dictionary as a ${roleMessage}. If you would like to help with this dictionary, then open this link: https://livingdictionaries.app/${dictionaryId}/invite/${inviteId} to  access the dictionary.

If you have any questions for ${invite.inviterName}, send an email to ${invite.inviterEmail} or just reply to this email.

Thank you,
Living Tongues Institute for Endangered Languages

https://livingtongues.org (Living Tongues Homepage)
https://livingdictionaries.app (Living Dictionaries website)`,
          },
        ],
      };

      const reply = await sendEmail(userMsg);
      console.log(reply);

      const inviteRef = db.doc(`dictionaries/${dictionaryId}/invites/${inviteId}`);
      await inviteRef.update({
        status: 'sent',
      });

      if (!adminRecipients.find((r) => r.email === invite.inviterEmail)) {
        const adminMsg: MailChannelsSendBody = {
          personalizations: [{ to: adminRecipients }],
          from: {
            email: 'jacob@livingtongues.org',
          },
          reply_to: { email: invite.inviterEmail },
          subject: `${invite.inviterName} has invited ${invite.targetEmail} to contribute to the ${invite.dictionaryName} Living Dictionary`,
          content: [
            {
              type: 'text/plain',
              value: `Hello Admins,

${invite.inviterName} has invited ${invite.targetEmail} to work on the ${invite.dictionaryName} Living Dictionary as a ${roleMessage}.

Dictionary URL: https://livingdictionaries.app/${dictionaryId}
            
If you have any questions for ${invite.inviterName}, just reply to this email.

Thanks,
Our automatic Firebase Cloud Function

https://livingdictionaries.app`,
            },
          ],
        };
        const adminReply = await sendEmail(adminMsg);
        console.log(adminReply);
      }
    }

    return { success: true };
  } catch (err) {
    console.log('Error', err);
    return { success: false };
  }
};
