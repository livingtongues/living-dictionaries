// From https://github.com/aws/aws-sdk-js-v3.
// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/ses-examples.html.

import { SESClient } from '@aws-sdk/client-ses';
import * as functions from 'firebase-functions';

const secretAccessKey = functions.config().aws.smtp_secret_access_key;
// Set by running `firebase functions:config:set aws.smtp_secret_access_key="your_key"`
// read with firebase functions:config:get
// remove with firebase functions:config:unset aws.smtp_secret_access_key

const REGION = 'us-west-2';
const sesClient = new SESClient({
  region: REGION,
  credentials: { accessKeyId: 'AKIAVLAFQGODQFD5DDC2', secretAccessKey },
});
export { sesClient };
