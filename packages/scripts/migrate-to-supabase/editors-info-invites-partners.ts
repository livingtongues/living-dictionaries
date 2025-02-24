import { db } from '../config-firebase'
import { admin_supabase } from '../config-supabase'
import { get_supabase_user_id_from_firebase_uid, load_fb_to_sb_user_ids } from './get-user-id'

agree_timestamps()

async function agree_timestamps() {
  await load_fb_to_sb_user_ids()

  const user_data = await db.collection('users').get()
  const users = user_data.docs.map((doc) => {
    const data = doc.data()
    return {
      user_id: doc.id,
      terms_agreement: data.termsAgreement,
    }
  })

  const users_that_have_agreed = users.filter(user => user.terms_agreement)
  for (const user of users_that_have_agreed) {
    let agreement_date = new Date('2019-01-01T00:00:00Z').toISOString()

    if (user.terms_agreement._seconds) {
      agreement_date = seconds_to_timestamp_string(user.terms_agreement._seconds)
    }

    if (typeof user.terms_agreement === 'number') {
      agreement_date = new Date(user.terms_agreement).toISOString()
    }

    const { error } = await admin_supabase.from('user_data')
      .update({ terms_agreement: agreement_date })
      .eq('id', get_supabase_user_id_from_firebase_uid(user.user_id))
    if (error) {
      console.error(error)
    } else {
      console.log('Updated user:', user.user_id)
    }
  }
}

function seconds_to_timestamp_string(seconds: number): string {
  return new Date(seconds * 1000).toISOString()
}
