import { redirect, error } from '@sveltejs/kit';

import type { IEntry } from '@living-dictionaries/types';
import { getDocument } from 'sveltefirets';

import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params, parent }) => {
  await parent();
  try {
    const entry = await getDocument<IEntry>(
      `dictionaries/${params.dictionaryId}/words/${params.entryId}`
    );
    if (entry) {
      return {
        initialEntry: entry,
      };
    } else {
      throw redirect(301, `/${params.dictionaryId}`);
    }
  } catch (err) {
    throw error(500, err);
  }
};
