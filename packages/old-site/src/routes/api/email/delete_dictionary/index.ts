import { getAdminRecipients } from '../addresses'
import { send_email } from '../send-email'

export async function send_delete_dictionary_admin_notice(dictionary_id: string) {
  try {
    const body = `Hi Admins, the dictionary with ID ${dictionary_id} has been deleted. - Automatic Notice`

    await send_email({
      to: getAdminRecipients(),
      subject: `Living Dictionary deleted: ${dictionary_id}`,
      type: 'text/plain',
      body,
    })
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
  }
}
