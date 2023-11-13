import { decodeToken } from '$lib/server/firebase-admin';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdminSupabaseClient } from '$lib/supabase/admin';

export interface SaveSenseRequestBody {
  auth_token: string;
  dictionary_id: string;
  entry_id: string;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { auth_token, dictionary_id, entry_id } = await request.json() as SaveSenseRequestBody;

    const decodedToken = await decodeToken(auth_token);
    if (!decodedToken?.uid)
      throw new Error('No user id found in token');

    // TODO: check if user has permission to edit this dictionaryId

    const adminSupabase = getAdminSupabaseClient();
    const { data, error } = await adminSupabase.from('entry_updates').insert([
      {
        user_id: decodedToken.uid,
        dictionary_id,
        entry_id,
        id: 'TODO: uuidv4 so can be idempotent',
        table: 'senses',
        column: 'glosses',
        row: '1',
        new_value: 'foo',
        timestamp: new Date().toISOString(),
      }
    ]).select();

    console.info({data,error})

    return json('success');
  }
  catch (err: any) {
    console.error(`Photo processing error when getting serving url: ${err.message}`);
    throw error(500, `Photo processing error when getting serving url: ${err.message}`);
  }
};
