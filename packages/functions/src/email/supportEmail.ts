import * as functions from 'firebase-functions';

import { supportMessageRecipients } from './recipients';
import { MailChannelsSendBody } from './mail-channels.interface';
import { sendEmail } from './mailChannels';

export default async (data: any, context: functions.https.CallableContext) => {
  const msg: MailChannelsSendBody = {
    personalizations: [{ to: supportMessageRecipients }],
    from: { email: 'annaluisa@livingtongues.org' },
    reply_to: { email: data.email },
    subject: 'Living Dictionaries Support Request',
    content: [
      {
        type: 'text/plain',
        value: `${data.message} 

Sent by ${data.name} (${data.email}) from ${data.url}`,
      },
    ],
  };
  const reply = await sendEmail(msg);
  console.log(reply);
  return { success: true };
};
