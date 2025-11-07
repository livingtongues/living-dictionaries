import type { Address } from './send-email'
import { dev } from '$app/environment'

export const no_reply_address = {
  email: 'no-reply@livingdictionaries.app',
  name: 'Living Tongues Institute for Endangered Languages',
}

export const dictionary_address = { email: 'dictionaries@livingtongues.org' }
export const jacobAddress = { email: 'jacob@livingtongues.org' }
const gregAddress = { email: 'livingtongues@gmail.com' }
const languages7000 = { email: 'info@7000.org' }

export function getAdminRecipients(initiatorEmail?: string): Address[] {
  if (initiatorEmail === 'jacob@livingtongues.org'
    || initiatorEmail === 'diego@livingtongues.org') {
    return [{ email: initiatorEmail }]
  }

  const recipients: Address[] = [
    jacobAddress,
    { email: 'diego@livingtongues.org' },
  ]

  if (dev)
    return recipients

  return [
    ...recipients,
    dictionary_address,
    gregAddress,
  ]
}

export function getSupportMessageRecipients({ dev }: { dev: boolean }): Address[] {
  const recipients: Address[] = [
    { email: 'jacob@livingtongues.org' },
    { email: 'diego@livingtongues.org' },
  ]

  if (dev)
    return recipients

  return [
    ...recipients,
    dictionary_address,
  ]
}

export function getLanguageLearningMaterialsRecipients({ dev }: { dev: boolean }): Address[] {
  const recipients: Address[] = [
    { email: 'jacob@livingtongues.org' },
    { email: 'diego@livingtongues.org' },
  ]

  if (dev)
    return recipients

  return [
    ...recipients,
    dictionary_address,
    languages7000,
  ]
}
