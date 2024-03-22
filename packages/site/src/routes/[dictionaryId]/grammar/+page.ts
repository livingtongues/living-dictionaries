import { getDocument } from 'sveltefirets';
import type { IGrammar } from '@living-dictionaries/types';

import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params }) => {
  try {
    const grammarDoc = await getDocument<IGrammar>(
      `dictionaries/${params.dictionaryId}/info/grammar`
    );
    return { grammar: grammarDoc?.grammar };
  } catch (err) {
    console.error(err);
    return { grammar: null };
  }
};
