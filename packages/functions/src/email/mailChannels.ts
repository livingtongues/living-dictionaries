import * as functions from 'firebase-functions';
import type { MailChannelsSendBody } from './mail-channels.interface';
import fetch from 'node-fetch'; // node-fetch is ESM only, so must import dynamically to use in commonjs or use v2: https://github.com/node-fetch/node-fetch#commonjs


const api_key = functions.config().mailchannels.api_key;
// Set by running `firebase functions:config:set mailchannels.api_key="your_key"`
// read with firebase functions:config:get
// remove with firebase functions:config:unset mailchannels.api_key

const cloudflareEmailEndpoint = 'https://send.livingdictionaries.workers.dev/';

export async function sendEmail(emailData: MailChannelsSendBody) {
  const response = await fetch(cloudflareEmailEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': api_key
    },
    body: JSON.stringify(emailData),
  });

  const responseText = await response.text();
  return response.status + ' ' + responseText;
}
