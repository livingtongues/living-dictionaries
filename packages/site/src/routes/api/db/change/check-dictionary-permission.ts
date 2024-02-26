import { getDb } from '$lib/server/firebase-admin';
import type { IUser } from '@living-dictionaries/types';

const db = getDb();

export async function checkForPermission(user_id: string, dictionary_id: string) {
  const dictionaryManagers = await db.collection(`dictionaries/${dictionary_id}/managers`).get();
  const isDictionaryManager = dictionaryManagers.docs.some(({ id }) => id === user_id);
  if (isDictionaryManager) return true;

  const dictionaryContributors = await db.collection(`dictionaries/${dictionary_id}/contributors`).get();
  const isDictionaryContributor = dictionaryContributors.docs.some(({ id }) => id === user_id);
  if (isDictionaryContributor) return true;

  const userSnap = await db.doc(`users/${user_id}`).get();
  const { roles } = userSnap.data() as IUser;
  if (roles?.admin) return true;

  throw new Error('Is not authorized to make changes to this dictionary.');
}
