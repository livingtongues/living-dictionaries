import * as functions from 'firebase-functions';
import { Address } from './mail-channels.interface';

// Set by running `firebase functions:config:set project.key="your_key"`
// read with `firebase functions:config:get`
const projectId = functions.config().project.key;

export const adminRecipients: Address[] = (() => {
  if (projectId === 'talking-dictionaries-alpha') {
    return [
      { email: 'livingtongues@gmail.com' }, // Greg
      { email: 'annaluisa@livingtongues.org' },
      { email: 'jacob@livingtongues.org' },
      { email: 'diego@livingtongues.org' },
    ];
  } else {
    //talking-dictionaries-dev
    return [{ email: 'jacob@livingtongues.org' }, { email: 'diego@livingtongues.org' }];
  }
})();

export const supportMessageRecipients: Address[] = (() => {
  if (projectId === 'talking-dictionaries-alpha') {
    return [
      { email: 'annaluisa@livingtongues.org' },
      { email: 'jacob@livingtongues.org' },
      { email: 'diego@livingtongues.org' },
    ];
  } else {
    //talking-dictionaries-dev
    return [{ email: 'jacob@livingtongues.org' }, { email: 'diego@livingtongues.org' }];
  }
})();