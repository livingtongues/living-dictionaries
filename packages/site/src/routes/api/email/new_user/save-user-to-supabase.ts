import type { GoogleAuthUserMetaData, IUser } from '@living-dictionaries/types'
import { getAdminSupabaseClient } from '$lib/supabase/admin'

export async function save_user_to_supabase(user: IUser): Promise<string> {
  console.info({ user })
  const adminSupabase = getAdminSupabaseClient()
  const { data, error } = await adminSupabase.auth.admin.createUser({
    email: user.email,
    email_confirm: true,
    app_metadata: { fb_uid: user.uid },
    user_metadata: get_firebase_user_meta_data(user),
  })
  console.info({ data, error })
  return data?.user?.id
}

function get_firebase_user_meta_data({ displayName, photoURL }: IUser) {
  const metadata: GoogleAuthUserMetaData = {}
  if (displayName)
    metadata.full_name = displayName
  if (photoURL)
    metadata.avatar_url = photoURL
  return metadata
}
