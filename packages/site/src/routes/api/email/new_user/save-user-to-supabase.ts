import { getAdminSupabaseClient } from '$lib/supabase/admin';
import type { IUser } from '@living-dictionaries/types';

export async function save_user_to_supabase(user: IUser): Promise<string> {
  const uuid = window.crypto.randomUUID();
  const adminSupabase = getAdminSupabaseClient();
  const { data, error } = await adminSupabase.from('auth.users').insert([
    {
      instance_id: '00000000-0000-0000-0000-000000000000',
      id: uuid,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      email_confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      raw_app_meta_data: get_firebase_app_meta_data(user),
      raw_user_meta_data: get_firebase_user_meta_data(user),
    }
  ]).select();
  console.info({data, error})
  return uuid
}

function get_firebase_app_meta_data(user: IUser) {
  let providers = ['email'];
  if (user.displayName)
    providers = ['google'];
  return { provider: providers[0], providers, fb_uid: user.uid };
}

function get_firebase_user_meta_data({displayName, photoURL}: IUser) {
  const metadata: {displayName?: string, photoURL?: string} = {}
  if (displayName)
    metadata.displayName = displayName;
  if (photoURL)
    metadata.photoURL = photoURL;
  return metadata;
}

