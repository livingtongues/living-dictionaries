import { log_once } from './log-once'

let firebase_uid_to_supabase_user_ids: Record<string, string> | null = null

export async function load_fb_to_sb_user_ids() {
  if (!firebase_uid_to_supabase_user_ids) {
    // eslint-disable-next-line require-atomic-updates
    firebase_uid_to_supabase_user_ids = (await import('./firestore-data/fb-sb-user-ids.json')).default
  }
}

export function get_supabase_user_id_from_firebase_uid(firebase_uid: string): string | null {
  if (!firebase_uid) return null

  const supabase_user_id = firebase_uid_to_supabase_user_ids?.[firebase_uid]
  if (!supabase_user_id) {
    log_once(`No Supabase user found for Firebase UID: ${firebase_uid}`)
  }
  return supabase_user_id
}
