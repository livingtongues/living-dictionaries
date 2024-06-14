import { firebaseConfig } from 'sveltefirets'
import type { Address } from './send/mail-channels.interface'
import { dev } from '$app/environment'

export const noReplyAddress = {
  email: 'no-reply@livingdictionaries.app',
  name: 'Living Tongues Institute for Endangered Languages',
}

export const officialAddress = { email: 'dictionaries@livingtongues.org' }
const gregAddress = { email: 'livingtongues@gmail.com' }
const languages7000 = { email: 'info@7000.org' }

export function getAdminRecipients(initiatorEmail: string): Address[] {
  if (initiatorEmail === 'jacob@livingtongues.org'
    || initiatorEmail === 'diego@livingtongues.org')
    return [{ email: initiatorEmail }]

  const recipients: Address[] = [
    { email: 'jacob@livingtongues.org' },
    { email: 'diego@livingtongues.org' },
  ]

  if (dev || firebaseConfig.projectId === 'talking-dictionaries-dev')
    return recipients

  return [
    ...recipients,
    officialAddress,
    gregAddress,
  ]
}

export function getSupportMessageRecipients({ dev }: { dev: boolean }): Address[] {
  const recipients: Address[] = [
    { email: 'jacob@livingtongues.org' },
    { email: 'diego@livingtongues.org' },
  ]

  if (dev || firebaseConfig.projectId === 'talking-dictionaries-dev')
    return recipients

  return [
    ...recipients,
    officialAddress,
  ]
}

export function getLanguageLearningMaterialsRecipients({ dev }: { dev: boolean }): Address[] {
  const recipients: Address[] = [
    // { email: 'jacob@livingtongues.org' },
    { email: 'diego@livingtongues.org' },
  ]

  if (dev || firebaseConfig.projectId === 'talking-dictionaries-dev')
    return recipients

  return [
    ...recipients,
    officialAddress,
    languages7000,
  ]
}
