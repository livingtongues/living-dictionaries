import { get } from 'svelte/store'
import { page } from '$app/stores'
import { api_dictionary_invite } from '$api/email/invite/_call'

export async function inviteHelper(
  role: 'manager' | 'contributor',
  dictionary_id: string,
) {
  const { data: { t } } = get(page)

  const target_email = prompt(`${t('contact.email')}?`)
  if (!target_email) return

  const isEmail = /^\S[^\s@]*@\S[^\s.]*\.\S+$/.test(target_email)
  if (!isEmail)
    return alert(t('misc.invalid'))

  const { error } = await api_dictionary_invite({
    dictionary_id,
    role,
    target_email,
    origin: location.origin,
  })

  if (error) {
    alert(`${t('misc.error')}: ${error.message}`)
    console.error(error)
  }
}
