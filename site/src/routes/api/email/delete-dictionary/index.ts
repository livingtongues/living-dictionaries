import { dictionary_address, get_admin_recipients, institute_no_reply_address } from '$lib/email/addresses'
import { send_email } from '$lib/email/send-email'

export async function send_delete_dictionary_admin_notice(dictionary_id: string) {
  try {
    const body = `Hi Admins, the dictionary with ID ${dictionary_id} has been deleted. - Automatic Notice`

    // from/reply_to preserve the legacy route-level sender's implicit defaults
    await send_email({
      from: institute_no_reply_address,
      reply_to: dictionary_address,
      to: get_admin_recipients(),
      subject: `Living Dictionary deleted: ${dictionary_id}`,
      type: 'text/plain',
      body,
    })
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
  }
}
