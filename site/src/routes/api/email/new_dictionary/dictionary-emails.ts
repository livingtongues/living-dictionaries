import type { Tables } from '$lib/types'
import newDictionary from '../html/newDictionary'
import { send_email } from '../send-email'

/**
 * Confirmation email to the dictionary's creator. The admin team is no longer
 * emailed here — new dictionaries post into the admin "Notifications" room
 * instead (`post_system_notification`), which pings each admin by their chosen
 * channel.
 */
export async function send_new_dictionary_creator_email(dictionary: Tables<'dictionaries'>, email: string) {
  try {
    await send_email({
      to: [{ email }],
      subject: 'New Living Dictionary Created',
      type: 'text/html',
      body: newDictionary(dictionary.name, dictionary.id),
    })
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
  }
}
