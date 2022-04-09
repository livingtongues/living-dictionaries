import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

// Learned from https://fireship.io/lessons/sendgrid-transactional-email-guide/
import * as sgMail from '@sendgrid/mail';
import { IDictionary, IUser } from '../../../src/lib/interfaces';
const sg_api_key = functions.config().sendgrid.key;
// Set by running `firebase functions:config:set sendgrid.key="your_key"` // see https://fireship.io/lessons/sendgrid-transactional-email-guide/
// read with firebase functions:config:get
sgMail.setApiKey(sg_api_key);

import { adminRecipients } from './adminRecipients';

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
      text: `Hey Admins,

${user.displayName} created a new Living Dictionary for ${dictionary.name}. Here's the details:

URL: https://livingdictionaries.app/${dictionaryId} 

Glossing languages: ${dictionary.glossLanguages}
Alternate names: ${dictionary.alternateNames ? dictionary.alternateNames : ''}
Alternate orthographies: ${
        dictionary.alternateOrthographies ? dictionary.alternateOrthographies : ''
      }
Coordinates: ${
        dictionary.coordinates
          ? 'lat: ' + dictionary.coordinates.latitude + ', lon: ' + dictionary.coordinates.longitude
          : ''
      }
Location: ${dictionary.location ? dictionary.location : ''}
Public: ${dictionary.public ? 'yes' : 'no'}
ISO 639-3: ${dictionary.iso6393 ? dictionary.iso6393 : ''}
Glottocode: ${dictionary.glottocode ? dictionary.glottocode : ''}

We sent ${user.displayName} an automatic dictionary-info email to ${
        user.email
      }, but you can also get in touch with them if needed.

Thanks,
Our automatic Firebase Cloud Function

https://livingdictionaries.app`,
    };
    const adminReply = await sgMail.send(adminMsg);
    console.log(adminReply);
  }

  return { success: true };
};
