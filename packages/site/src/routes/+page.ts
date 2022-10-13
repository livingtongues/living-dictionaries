import { error } from '@sveltejs/kit';

import { getCollection } from 'sveltefirets';
import { orderBy, where } from 'firebase/firestore';
import type { IDictionary } from '@living-dictionaries/types';

import type { PageLoad } from './$types';
export const load: PageLoad = async ({ parent }) => {
  await parent();
  try {
    const publicDictionaries = await getCollection<IDictionary>('dictionaries', [
      orderBy('name'),
      where('public', '==', true),
    ]);
    return { publicDictionaries };
  } catch (err) {
    throw error(500, err);
  }
};
