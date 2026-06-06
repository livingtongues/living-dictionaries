import type { Address } from './send-email'
import { dev } from '$app/environment'

export const no_reply_address = {
  email: 'no-reply@livingdictionaries.app',
  name: 'Living Tongues Institute for Endangered Languages',
}

export const dictionary_address = { email: 'dictionaries@livingtongues.org' }
export const jacobAddress = { email: 'jacob@livingtongues.org' }
const gregAddress = { email: 'livingtongues@gmail.com' }
/** The external 7000.org Languages partner — emailed on learning-materials requests. */
export const languages_7000_address = { email: 'info@7000.org' }

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
