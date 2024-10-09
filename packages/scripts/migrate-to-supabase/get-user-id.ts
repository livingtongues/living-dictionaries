import { jacob_ld_user_id } from '../config-supabase'
import firebase_uid_to_supabase_user_ids from './firestore-data/fb-sb-user-ids.json'
import { log_once } from './log-once'

export function get_supabase_user_id_from_firebase_uid(firebase_uid: string): string {
  if (!firebase_uid)
    return jacob_ld_user_id
  // @ts-expect-error
  const supabase_user_id = firebase_uid_to_supabase_user_ids[firebase_uid]
  if (!supabase_user_id) {
    log_once(`No Supabase user found for Firebase UID: ${firebase_uid}`)
  }
  return supabase_user_id
}
