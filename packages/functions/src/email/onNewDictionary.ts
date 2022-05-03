import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

// Learned from https://fireship.io/lessons/sendgrid-transactional-email-guide/
import * as sgMail from '@sendgrid/mail';
import { IDictionary, IUser } from '@ld/types';
const sg_api_key = functions.config().sendgrid.key;
// Set by running `firebase functions:config:set sendgrid.key="your_key"` // see https://fireship.io/lessons/sendgrid-transactional-email-guide/
// read with firebase functions:config:get
sgMail.setApiKey(sg_api_key);

import { adminRecipients } from './adminRecipients';
import { notifyAdminsOnNewDictionary } from './composeMessages';

export default async (
  snapshot: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {
  const dictionary = snapshot.data() as IDictionary;
  const dictionaryId = context.params.dictionaryId;

  const userSnap = await admin
    .firestore()
    .doc(`users/${dictionary && dictionary.createdBy}`)
    .get();
  const user = userSnap.data() as IUser;

  if (dictionary && user) {
    const msg = {
      from: 'annaluisa@livingtongues.org',
      to: user.email,
      templateId: 'd-06857893fe684cd68ff11aec2fe7e36d', // "Created Dictionary"
      dynamic_template_data: {
        subject: 'New Living Dictionary Created',
        dictionaryName: dictionary.name,
        dictionaryId,
      },
    };
    const reply = await sgMail.send(msg);
    console.log(reply);

    const adminMsg = {
      from: 'jacob@livingtongues.org',
      to: adminRecipients,
      subject: `Living Dictionary created: ${dictionary.name}`,
      trackingSettings: {
        clickTracking: {
          enable: false,
          enableText: false,
        },
      },
      text: notifyAdminsOnNewDictionary(dictionary, dictionaryId, user),
    };
    const adminReply = await sgMail.send(adminMsg);
    console.log(adminReply);
  }

  return { success: true };
};
