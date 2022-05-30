import * as functions from 'firebase-functions';
import { db } from '../config';

import { mailersend, Recipient, EmailParams } from 'mailersend';
import { adminRecipients } from './adminRecipients';

import { IInvite } from '@living-dictionaries/types';

export default async (
  snapshot: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {
  const invite = snapshot.data() as IInvite;
  const dictionaryId = context.params.dictionaryId;
  const inviteId = context.params.inviteId;

  try {
    const roleMessage =
      invite.role === 'manager'
        ? 'manager'
        : 'contributor, which allows you to add and edit entries';
    if (invite) {

      const recipients = [
        // new Recipient("your@client.com", "Your Client")
        new Recipient(invite.targetEmail)
      ];
      
      const emailParams = new EmailParams()
            .setFrom("annaluisa@livingtongues.org")
            .setFromName("Anna Luisa Daigneault")
            .setRecipients(recipients)
            .setReplyTo(invite.inviterEmail)
            .setReplyToName(invite.inviterEmail)
            .setSubject(`${invite.inviterName} has invited you to contribute to the ${invite.dictionaryName} Living Dictionary`)
            .setHtml(`Hello,

${invite.inviterName} has invited you to work on the ${invite.dictionaryName} Living Dictionary as a ${roleMessage}. If you would like to help with this dictionary, then open this link: https://livingdictionaries.app/${dictionaryId}/invite/${inviteId} to  access the dictionary.

If you have any questions for ${invite.inviterName}, send an email to ${invite.inviterEmail} or just reply to this email.

Thank you,
Living Tongues Institute for Endangered Languages

https://livingtongues.org (Living Tongues Homepage)
https://livingdictionaries.app (Living Dictionaries website)`);
      
      const reply = await mailersend.send(emailParams);
      console.log(reply);

      const inviteRef = db.doc(`dictionaries/${dictionaryId}/invites/${inviteId}`);
      await inviteRef.update({
        status: 'sent',
      });

      if (!adminRecipients.includes(invite.inviterEmail)) {
        const adminMsg: SendEmailCommandInput = {
          Source: 'jacob@livingtongues.org',
          Destination: {
            ToAddresses: adminRecipients,
          },
          ReplyToAddresses: [invite.inviterEmail],
          Message: {
            Subject: {
              Charset: 'UTF-8',
              Data: `${invite.inviterName} has invited ${invite.targetEmail} to contribute to the ${invite.dictionaryName} Living Dictionary`,
            },
            Body: {
              Text: {
                Charset: 'UTF-8',
                Data: `Hello Admins,

${invite.inviterName} has invited ${invite.targetEmail} to work on the ${invite.dictionaryName} Living Dictionary as a ${roleMessage}.

Dictionary URL: https://livingdictionaries.app/${dictionaryId}
            
If you have any questions for ${invite.inviterName}, just reply to this email.

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
    }

    return { success: true };
  } catch (err) {
    console.log('Error', err);
    return { success: false };
  }
};
