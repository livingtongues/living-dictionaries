import { redirect, error } from '@sveltejs/kit';

import type { IDictionary } from '@living-dictionaries/types';
import { getDocument } from 'sveltefirets';

import type { LayoutLoad } from './$types';
export const load: LayoutLoad = async ({ params }) => {
  try {
    const dictionary = await getDocument<IDictionary>(`dictionaries/${params.dictionaryId}`);
    if (dictionary)
      return { dictionary };

    throw redirect(301, '/');

  } catch (e) {
    throw error(500, e);
  }
};
