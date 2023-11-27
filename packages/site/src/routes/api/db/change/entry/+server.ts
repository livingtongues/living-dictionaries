import { decodeToken, getDb } from '$lib/server/firebase-admin';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdminSupabaseClient } from '$lib/supabase/admin';
import type { IUser } from '@living-dictionaries/types';
import type { ChangeEntryRequestBody } from '$lib/supabase/change/types';
import { ResponseCodes } from '$lib/constants';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { auth_token, id, table, dictionary_id, entry_id, column, row, new_value, old_value, timestamp } = await request.json() as ChangeEntryRequestBody;

    const decodedToken = await decodeToken(auth_token);
    if (!decodedToken?.uid)
      throw new Error('No user id found in token');

    const db = getDb();
    const checkForPermission = async () => {
      const dictionaryManagers = await db.collection(`dictionaries/${dictionary_id}/managers`).get();
      const isDictionaryManager = dictionaryManagers.docs.some(({ id }) => id === decodedToken.uid);
      if (isDictionaryManager) return true;

      const dictionaryContributors = await db.collection(`dictionaries/${dictionary_id}/contributors`).get();
      const isDictionaryContributor = dictionaryContributors.docs.some(({ id }) => id === decodedToken.uid);
      if (isDictionaryContributor) return true;

      const userSnap = await db.doc(`users/${decodedToken.uid}`).get();
      const { roles } = userSnap.data() as IUser;
      if (roles?.admin) return true;

      throw new Error('Is not a manager of this dictionary.');
    };
    await checkForPermission();

    const adminSupabase = getAdminSupabaseClient();
    const { data, error: insertError } = await adminSupabase.from('entry_updates').insert([
      {
        user_id: decodedToken.uid,
        dictionary_id,
        entry_id,
        id,
        table,
        row,
        column,
        new_value,
        old_value,
        timestamp,
      }
    ]).select();

    if (insertError)
      throw new Error(insertError.message);

    return json(data);
  }
  catch (err: any) {
    console.error(`Error saving sense: ${err.message}`);
    throw error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error saving sense: ${err.message}`);
  }
};
