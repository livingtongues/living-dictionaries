import { getDocument } from 'sveltefirets';
import type { IGrammar } from '@living-dictionaries/types';
import { isManager } from '$lib/stores';

import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params, parent }) => {
  await parent();
  try {
    const grammarDoc = await getDocument<IGrammar>(
      `dictionaries/${params.dictionaryId}/info/grammar`
    );
    return { grammar: grammarDoc?.grammar, isManager };
  } catch (err) {
    console.error(err);
    return { grammar: null, isManager };
  }
};
