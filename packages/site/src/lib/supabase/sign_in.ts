import type { AuthError, User } from '@supabase/supabase-js'
import { api_email_new_user } from '$api/email/new_user/_call'
import { dev } from '$app/environment'
import { invalidateAll } from '$app/navigation'
import { toast } from '$lib/components/ui/Toasts.svelte'
import type { Supabase } from '$lib/supabase'

const TEN_SECONDS = 10000
const FOUR_SECONDS = 4000

export async function handle_sign_in_response({ user, error, supabase }: { user?: User, error?: AuthError, supabase: Supabase }) {
  if (error) {
    console.info({ error })
    return toast(error.message, TEN_SECONDS)
  }

  toast(`Signed in with ${user.email}`, FOUR_SECONDS)
  invalidateAll()

  if (!dev) {
    const { data, error: check_for_email_status_error } = await supabase.from('user_data').select('welcome_email_sent').eq('id', user.id)
    if (check_for_email_status_error)
      return console.error({ check_for_email_status_error })
    if (!data?.[0]?.welcome_email_sent) {
      const { error: sending_welcome_error } = await api_email_new_user({ })
      if (sending_welcome_error)
        console.error({ sending_welcome_error })
    }
  }
}
