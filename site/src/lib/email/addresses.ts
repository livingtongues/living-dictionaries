/**
 * LD outbound sender addresses. The domain `livingdictionaries.app` is
 * already SES-verified (legacy LD uses the same domain), so no fresh
 * DKIM / verification work is needed at cutover.
 */
import { dev } from '$app/environment'

export interface Address {
  email: string
  name?: string
}

export const no_reply_address: Address = {
  email: 'no-reply@livingdictionaries.app',
  name: 'Living Dictionaries',
}

/**
 * Same no-reply mailbox, branded with the Institute name — the historical From
 * on the dictionary-lifecycle emails (invites, new/deleted dictionary notices,
 * OTP codes, contact-form routing). Kept distinct from `no_reply_address` so
 * migrating those call sites off the legacy route-level sender changed nothing.
 */
export const institute_no_reply_address: Address = {
  email: 'no-reply@livingdictionaries.app',
  name: 'Living Tongues Institute for Endangered Languages',
}

export const support_address: Address = {
  email: 'support@livingdictionaries.app',
  name: 'Living Dictionaries',
}

export const dictionary_address: Address = { email: 'dictionaries@livingtongues.org' }
export const jacob_address: Address = { email: 'jacob@livingtongues.org' }
const greg_address: Address = { email: 'livingtongues@gmail.com' }
/** The external 7000.org Languages partner — emailed on learning-materials requests. */
export const languages_7000_address: Address = { email: 'info@7000.org' }

export function get_admin_recipients(initiator_email?: string): Address[] {
  if (initiator_email === 'jacob@livingtongues.org'
    || initiator_email === 'diego@livingtongues.org') {
    return [{ email: initiator_email }]
  }

  const recipients: Address[] = [
    jacob_address,
    { email: 'diego@livingtongues.org' },
  ]

  if (dev)
    return recipients

  return [
    ...recipients,
    dictionary_address,
    greg_address,
  ]
}
