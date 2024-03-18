import type { LayoutLoad } from './$types';
import { getTranslator } from '$lib/i18n'
import { getSupportedLocale } from '$lib/i18n/locales'
import { createUserStore, firebaseConfig, getDb, getDocument } from 'sveltefirets';
import { derived, type Readable } from 'svelte/store';
import type { IUser, IDictionary } from '@living-dictionaries/types';
import { browser } from '$app/environment';
import { collectionGroup, getDocs, query, where } from 'firebase/firestore';
import { createPersistedStore } from 'svelte-pieces';
import { defaultColumns } from '$lib/stores/columns';

export const load: LayoutLoad = async ({  url: { searchParams }, data: { serverLocale, user_from_cookies } }) => {
  const urlLocale = searchParams.get('lang')
  const locale = getSupportedLocale(urlLocale || serverLocale) || 'en'
  const t = await getTranslator(locale)

  // TODO: update this to pass in user_from_cookies including admin role and then check in dictionaryId/layout.ts for admin to see if should create_entries_store
  const user = createUserStore<IUser>({
    userKey: `${firebaseConfig.projectId}_firebase_user`,
    log: true,
  });

  const admin = derived(user, ($user) => {
    return $user?.roles?.admin || 0;
  });

  const user_dictionaries = get_user_dictionaries(user_from_cookies, user);

  const columns_key = `table_columns_03.18.2024-${user_from_cookies?.uid}`; // rename when adding more columns to invalidate the user's cache
  const preferred_table_columns = createPersistedStore(columns_key, defaultColumns);

  return { locale, t, user, admin, user_dictionaries, preferred_table_columns }
};


function get_user_dictionaries(user_from_cookies: IUser, user: Readable<IUser>) {
  const key_from_cookie = `my_dictionaries-${user_from_cookies?.uid}`;
  const user_dictionaries = derived<Readable<IUser>, IDictionary[]>(
    user,
    ($user, set) => {
      if ($user) {
        const key_from_user = `my_dictionaries-${$user.uid}`;
        load_user_dictionaries($user.uid)
          .then((dictionaries) => {
            set(dictionaries);
            localStorage.setItem(key_from_user, JSON.stringify(dictionaries));
          })
          .catch((error) => console.error(error));
        return () => localStorage.removeItem(key_from_user);
      }
      set([]);
    },
    browser && user_from_cookies ? JSON.parse(localStorage[key_from_cookie] || '[]') : []
  );
  return user_dictionaries;
}

async function load_user_dictionaries(userId: string) {
  const dictionary_ids_with_role = [];
  const db = getDb();

  const managers = query(collectionGroup(db, 'managers'), where('id', '==', userId));
  const managersSnapshot = await getDocs(managers);
  managersSnapshot.forEach((doc) => {
    const id = doc.ref.path.match(/dictionaries\/(.*?)\//)[1];
    dictionary_ids_with_role.push({ id, dictRole: 'manager' });
  });

  const contributors = query(collectionGroup(db, 'contributors'), where('id', '==', userId));
  const contributorsSnapshot = await getDocs(contributors);
  contributorsSnapshot.forEach((doc) => {
    const id = doc.ref.path.match(/dictionaries\/(.*?)\//)[1];
    dictionary_ids_with_role.push({ id, dictRole: 'contributor' });
  });

  return await Promise.all(dictionary_ids_with_role.map((d) => {
    return getDocument<IDictionary>(`dictionaries/${d.id}`);
  }));
  // TODO: merge in dictRole from myDictionaryIds to myDictionaries
}
