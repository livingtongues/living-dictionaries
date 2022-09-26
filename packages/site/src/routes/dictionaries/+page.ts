import { error } from '@sveltejs/kit';

import type { IDictionary } from '@living-dictionaries/types';
import { getCollection } from 'sveltefirets';
import { orderBy, where } from 'firebase/firestore';

import type { PageLoad } from './$types';
export const load: PageLoad = async () => {
  try {
    const publicDictionaries = await getCollection<IDictionary>('dictionaries', [
      orderBy('name'),
      where('public', '==', true),
    ]);
    return { publicDictionaries };
  } catch (e) {
    throw error(500, e);
  }
};
