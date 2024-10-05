import type { ISpeaker, TablesUpdate } from '@living-dictionaries/types'
import { get_supabase_user_id_from_firebase_uid, seconds_to_timestamp_string } from './convert-entries'

export function convert_speaker(fb_speaker: ISpeaker): { id: string, speaker: TablesUpdate<'speakers'> } {
  const {
    displayName,
    uid,
    decade,
    birthplace,
    contributingTo,
    gender,
    id,
    createdAt,
    createdBy,
    updatedAt,
    updatedBy,
  } = fb_speaker

  if (!contributingTo || contributingTo.length === 0) {
    throw new Error(`Speaker ${displayName} has no contributingTo`)
  }

  if (contributingTo.length > 1) {
    console.warn(`Speaker ${displayName} has multiple contributingTo`)
  }

  const created_by = get_supabase_user_id_from_firebase_uid(createdBy)

  const decade_number = (typeof decade === 'string' && decade.trim() !== '')
    ? Number.parseInt(decade)
    : (typeof decade === 'number')
        ? decade
        : null

  const speaker: TablesUpdate<'speakers'> = {
    dictionary_id: contributingTo[0],
    birthplace,
    name: displayName,
    decade: decade_number,
    gender: gender ? gender.trim() as 'm' | 'f' | 'o' : null,
    created_by,
    updated_by: updatedBy ? get_supabase_user_id_from_firebase_uid(updatedBy) : created_by,
    user_id: uid ? get_supabase_user_id_from_firebase_uid(uid) : null,
  }

  if (createdAt?.seconds) {
    speaker.created_at = seconds_to_timestamp_string(createdAt.seconds)
    speaker.updated_at = updatedAt ? seconds_to_timestamp_string(updatedAt.seconds) : speaker.created_at
  }

  return { id, speaker }
}
