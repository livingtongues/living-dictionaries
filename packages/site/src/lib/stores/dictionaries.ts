import { derived } from 'svelte/store';
import type { Readable } from 'svelte/store';
import { user } from './user';
import type { IUser, IDictionary } from '$lib/interfaces';
import { browser } from '$app/env';
import { db, getDocument } from '$sveltefirets';
import { collectionGroup, getDocs, query, where } from 'firebase/firestore';

const key = 'my_dictionaries';
export const myDictionaries = derived<Readable<IUser>, IDictionary[]>(
  user,
  ($user, set) => {
    if ($user) {
      getMyDictionaries($user.uid)
        .then((dictionaries) => {
          set(dictionaries);
          localStorage.setItem(key, JSON.stringify(dictionaries));
        })
        .catch((error) => console.error(error));
      return () => {
        localStorage.removeItem(key);
      };
    } else {
      set([]);
    }
  },
  browser ? JSON.parse(localStorage[key] || '[]') : []
);

async function getMyDictionaries(userId: string) {
  const myDictionaryIds = [];

  const managers = query(collectionGroup(db, 'managers'), where('id', '==', userId));
  const managersSnapshot = await getDocs(managers);
  managersSnapshot.forEach((doc) => {
    const id = doc.ref.path.match(/dictionaries\/(.*?)\//)[1];
    myDictionaryIds.push({ id, dictRole: 'manager' });
  });

  const contributors = query(collectionGroup(db, 'contributors'), where('id', '==', userId));
  const contributorsSnapshot = await getDocs(contributors);
  contributorsSnapshot.forEach((doc) => {
    const id = doc.ref.path.match(/dictionaries\/(.*?)\//)[1];
    myDictionaryIds.push({ id, dictRole: 'contributor' });
  });

  const myDictionaryPromises = myDictionaryIds.map((d) => {
    return getDocument<IDictionary>(`dictionaries/${d.id}`);
  });
  return await Promise.all(myDictionaryPromises);
  // TODO: merge in dictRole from myDictionaryIds to myDictionaries
}
