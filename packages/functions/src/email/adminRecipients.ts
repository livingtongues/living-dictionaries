import * as functions from 'firebase-functions';

export const adminRecipients = (() => {
  // Set by running `firebase functions:config:set project.key="your_key"`
  // read with `firebase functions:config:get`
  const projectId = functions.config().project.key;
  if (projectId === 'talking-dictionaries-alpha') {
    return [
      'jacob@livingtongues.org',
      'annaluisa@livingtongues.org',
      'livingtongues@gmail.com', // Greg
      'diego@livingtongues.org',
    ];
  } else {
    //talking-dictionaries-dev
    return ['jacob@livingtongues.org', 'diego@livingtongues.org'];
  }
})();
