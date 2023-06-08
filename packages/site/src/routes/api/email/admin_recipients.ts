import { dev } from '$app/environment';
import type { Address } from './send/mail-channels.interface';
import { firebaseConfig } from 'sveltefirets';

export function getAdminRecipients(initiatorEmail: string): Address[] {
  if (initiatorEmail === 'jacob@livingtongues.org'
    || initiatorEmail === 'diego@livingtongues.org')
    return [{ email: initiatorEmail }]

  if (dev || firebaseConfig.projectId === 'talking-dictionaries-dev')
    return [
      { email: 'jacob@livingtongues.org' },
      { email: 'diego@livingtongues.org' },
    ]

  return [
    { email: 'jacob@livingtongues.org' },
    { email: 'diego@livingtongues.org' },
    { email: 'annaluisa@livingtongues.org' },
    { email: 'livingtongues@gmail.com' }, // Greg
  ];
};