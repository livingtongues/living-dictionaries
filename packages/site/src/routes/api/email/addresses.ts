import { dev } from '$app/environment';
import type { Address } from './send/mail-channels.interface';
import { firebaseConfig } from 'sveltefirets';

export const noReplyAddress = {
  email: 'no-reply@livingdictionaries.app',
  name: 'Living Tongues Institute for Endangered Languages',
}

export function getAdminRecipients(initiatorEmail: string): Address[] {
  if (initiatorEmail === 'jacob@livingtongues.org'
    || initiatorEmail === 'diego@livingtongues.org')
    return [{ email: initiatorEmail }]

  const recipients: Address[] = [
    { email: 'jacob@livingtongues.org' },
    // { email: 'diego@livingtongues.org' },
  ]

  if (dev || firebaseConfig.projectId === 'talking-dictionaries-dev')
    return recipients

  return [
    ...recipients,
    { email: 'annaluisa@livingtongues.org' },
    { email: 'livingtongues@gmail.com' }, // Greg
  ];
};