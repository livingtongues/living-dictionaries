import { admin_supabase } from '../config-supabase'
import senses_with_problems_array from './firestore-data/deal.json'
import firebase_to_supabase_id from './firestore-data/fb-sb-user-ids.json'
import firestore_users_array from './firestore-data/firestore-users.json'

convert_firebase_email_or_id_to_supabase_id()

async function convert_firebase_email_or_id_to_supabase_id() {
  const sense_updates = senses_with_problems_array.map(({ sense_id, created_by, updated_by, updated_at }) => {
    return {
      id: sense_id,
      created_by: convert_email_or_id_to_supabase_id(created_by),
      updated_by: convert_email_or_id_to_supabase_id(updated_by),
      updated_at,
    }
  })
  console.log(sense_updates)
  for (const update of sense_updates) {
    const { data, error } = await admin_supabase.from('senses').update(update).eq('id', update.id).select()
    if (error) {
      console.error(`Error updating sense ${update.id}:`, error)
      throw new Error(error.message)
    } else {
      console.log(data)
    }
  }
}

function convert_email_or_id_to_supabase_id(email_or_id: string) {
  const isEmail = email_or_id.includes('@')
  if (isEmail) {
    // If it's an email, find the corresponding Supabase ID in the firestore_users_array
    const { uid } = firestore_users_array.find(user => user.email === email_or_id)
    return (firebase_to_supabase_id as Record<string, string>)[uid]
  }

  if (email_or_id.includes('-'))
    return email_or_id // If it's a UUID, return it as is

  // If it's a Firebase ID, find the corresponding Supabase ID in the firebase_to_supabase_id array
  return (firebase_to_supabase_id as Record<string, string>)[email_or_id]
}
