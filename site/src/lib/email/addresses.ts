import type { Address } from './send-email'

/**
 * LD outbound sender addresses. The domain `livingdictionaries.app` is
 * already SES-verified (legacy LD uses the same domain), so no fresh
 * DKIM / verification work is needed at cutover.
 */

export const no_reply_address: Address = {
  email: 'no-reply@livingdictionaries.app',
  name: 'Living Dictionaries',
}

export const support_address: Address = {
  email: 'support@livingdictionaries.app',
  name: 'Living Dictionaries',
}
