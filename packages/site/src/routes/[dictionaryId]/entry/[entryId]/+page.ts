import { redirect, error } from '@sveltejs/kit';

import type { ActualDatabaseEntry } from '@living-dictionaries/types';
import { getDocument } from 'sveltefirets';
import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';

import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params, parent }) => {
  await parent();
  try {
    const entry = await getDocument<ActualDatabaseEntry>(
      `dictionaries/${params.dictionaryId}/words/${params.entryId}`
    );
    if (entry) {
      return {
        initialEntry: convert_and_expand_entry(entry),
      };
    } else {
      throw redirect(301, `/${params.dictionaryId}`);
    }
  } catch (err) {
    throw error(500, err);
  }
};

