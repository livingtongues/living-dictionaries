import { decodeToken } from '$lib/server/firebase-admin';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdminSupabaseClient } from '$lib/supabase/admin';
import { ResponseCodes } from '$lib/constants';
import type { Database, TablesInsert } from '$lib/supabase/generated.types';
import { checkForPermission } from '../check-dictionary-permission';

export interface ChangeEntryRequestBody {
  auth_token: string;
  id: string; // id of the change, a uuidv4 created on client to make things idempotent
  dictionary_id: string;
  entry_id: string;
  table: Database['public']['Enums']['entry_tables'];
  column: Database['public']['Enums']['entry_columns'];
  row: string; // uuidv4 created by client if insert, otherwise id of row to update
  new_value: string; // JSON stringified if column type is jsonb (glosses, parts_of_speech, semantic_domains, write_in_semantic_domains)
  old_value?: string;
  timestamp: string;
}

export type ChangeEntryResponseBody = TablesInsert<'entry_updates'>

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { auth_token, id, table, dictionary_id, entry_id, column, row, new_value, old_value, timestamp } = await request.json() as ChangeEntryRequestBody;

    const decodedToken = await decodeToken(auth_token);
    if (!decodedToken?.uid)
      throw new Error('No user id found in token');

    await checkForPermission(decodedToken.uid, dictionary_id);

    const adminSupabase = getAdminSupabaseClient();
    const { data: entry_update, error: insertError } = await adminSupabase.from('entry_updates').insert({
      user_id: decodedToken.email, // until Firebase migration is finished, Supabase DB trigger function will lookup matching supabase user id and replace this field with the user id
      dictionary_id,
      entry_id,
      id,
      table,
      row,
      column,
      new_value,
      old_value,
      timestamp,
    })
      .select()
      .single()

    if (insertError)
      throw new Error(insertError.message);

    return json(entry_update satisfies ChangeEntryResponseBody);
  }
  catch (err) {
    console.error(`Error saving sense: ${err.message}`);
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error saving sense: ${err.message}`);
  }
};
