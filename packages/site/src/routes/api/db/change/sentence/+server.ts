import { decodeToken } from '$lib/server/firebase-admin';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdminSupabaseClient } from '$lib/supabase/admin';
import { ResponseCodes } from '$lib/constants';
import type { Database, TablesInsert } from '$lib/supabase/generated.types';
import { checkForPermission } from '../check-dictionary-permission';

export interface ChangeSentenceRequestBody {
  id: string; // id of the change, a uuidv4 created on client to make things idempotent
  auth_token: string;
  dictionary_id: string;
  sentence_id: string;
  sense_id?: string;
  timestamp: string;
  table: Database['public']['Enums']['content_tables'];
  change: any;
}

export type ChangeSentenceResponseBody = TablesInsert<'content_updates'>

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { auth_token, id, table, dictionary_id, sentence_id, sense_id, change, timestamp } = await request.json() as ChangeSentenceRequestBody;

    const decodedToken = await decodeToken(auth_token);
    if (!decodedToken?.uid)
      throw new Error('No user id found in token');

    await checkForPermission(decodedToken.uid, dictionary_id);

    const adminSupabase = getAdminSupabaseClient();
    const { data: sentence_update, error: insert_error } = await adminSupabase.from('content_updates').insert({
      id,
      user_id: '11111111-1111-1111-1111-111111111111', // will be replaced by trigger that pulls appropriate user id from supabase auth.users using firebase_email
      firebase_email: decodedToken.email,
      dictionary_id,
      sentence_id,
      sense_id,
      timestamp,
      table,
      change,
    })
      .select()
      .single()

    // TODO: update the appropriate tables in the db

    if (insert_error)
      throw new Error(insert_error.message);

    return json(sentence_update satisfies ChangeSentenceResponseBody);
  }
  catch (err) {
    console.error(`Error saving sentence: ${err.message}`);
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error saving sentence: ${err.message}`);
  }
};
