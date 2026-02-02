import { api_dictionary_invite } from '$api/email/invite/_call'
import { page } from '$app/state'

export async function inviteHelper(
  role: 'manager' | 'contributor',
  dictionary_id: string,
) {
  const target_email = prompt(`${page.data.t('contact.email')}?`)
  if (!target_email) return

  const isEmail = /^\S[^\s@]*@\S[^\s.]*\.\S+$/.test(target_email)
  if (!isEmail)
    return alert(page.data.t('misc.invalid'))

  const { error } = await api_dictionary_invite({
    dictionary_id,
    role,
    target_email,
    origin: location.origin,
  })

  if (error) {
    alert(`${page.data.t('misc.error')}: ${error.message}`)
    console.error(error)
  }
}
