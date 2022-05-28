import * as functions from 'firebase-functions';
const projectId = functions.config().project.key;
import { sesClient } from './sesClient';
import { SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';

export default async (data: any, context: functions.https.CallableContext) => {
  const msg: SendEmailCommandInput = {
    Source: 'jacob@livingtongues.org',
    Destination: {
      ToAddresses: [
        projectId === 'talking-dictionaries-alpha'
          ? 'annaluisa@livingtongues.org'
          : 'jacob@livingtongues.org',
      ],
    },
    ReplyToAddresses: [data.email],
    Message: {
      Subject: {
        Charset: 'UTF-8',
        Data: 'Living Dictionaries Support Request',
      },
      Body: {
        Text: {
          Charset: 'UTF-8',
          Data: `${data.message} 

Sent by ${data.name} (${data.email}) from ${data.url}`,
        },
      },
    },
  };
  const reply = await sesClient.send(new SendEmailCommand(msg));
  console.log(reply);
  return { success: true };
};
