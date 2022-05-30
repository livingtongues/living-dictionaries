// From https://github.com/aws/aws-sdk-js-v3.
// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/ses-examples.html.

import * as functions from 'firebase-functions';
// import * as MailerSend from "mailersend";
const Recipient = require('mailersend').Recipient;
const EmailParams = require('mailersend').EmailParams;
const MailerSend = require('mailersend');

const api_key = functions.config().mailersend.api_key;
// Set by running `firebase functions:config:set mailersend.api_key="your_key"`
// read with firebase functions:config:get
// remove with firebase functions:config:unset aws.smtp_secret_access_key

const mailersend = new MailerSend({ api_key });
export { mailersend, Recipient, EmailParams };
