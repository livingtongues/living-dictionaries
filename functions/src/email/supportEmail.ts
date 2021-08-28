import * as functions from 'firebase-functions';

import * as sgMail from '@sendgrid/mail';
const sg_api_key = functions.config().sendgrid.key;
// Set by running `firebase functions:config:set sendgrid.key="your_key"` // see https://fireship.io/lessons/sendgrid-transactional-email-guide/
// read with firebase functions:config:get
sgMail.setApiKey(sg_api_key);

// https://sendgrid.com/docs/api-reference/
// https://sendgrid.com/docs/API_Reference/Web_API_v3/Mail/index.html

export default async (
    data: any,
    context: functions.https.CallableContext
) => {
    const msg = {
        from: 'jacob@livingtongues.org',
        to: 'annaluisa@livingtongues.org',
        replyTo: data.email,
        subject: 'Living Dictionaries Support Request',
        trackingSettings: {
            clickTracking: {
                enable: false,
                enableText: false,
            }
        },
        text: `${data.message} 

Sent by ${data.name} (${data.email}) from ${data.url}`,
    };
    const reply = await sgMail.send(msg);
    console.log(reply);
    return { success: true };
}