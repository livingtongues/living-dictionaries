import type { Tables } from '$lib/types'
import newDictionary from '../html/new-dictionary'
import { dictionary_address, institute_no_reply_address } from '$lib/email/addresses'
import { send_email } from '$lib/email/send-email'

/**
 * Confirmation email to the dictionary's creator. The admin team is no longer
 * emailed here — new dictionaries post into the admin "Notifications" room
 * instead (`post_system_notification`), which pings each admin by their chosen
 * channel.
 */
export async function send_new_dictionary_creator_email(dictionary: Tables<'dictionaries'>, email: string) {
  try {
    // from/reply_to preserve the legacy route-level sender's implicit defaults
    await send_email({
      from: institute_no_reply_address,
      reply_to: dictionary_address,
      to: [{ email }],
      subject: 'New Living Dictionary Created',
      type: 'text/html',
      body: newDictionary(dictionary.name, dictionary.id),
    })
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
  }
}
