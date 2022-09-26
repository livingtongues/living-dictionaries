import { getDocument } from 'sveltefirets';
import type { IGrammar } from '@living-dictionaries/types';

import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params }) => {
  try {
    const grammarDoc = await getDocument<IGrammar>(
      `dictionaries/${params.dictionaryId}/info/grammar`
    );
    if (grammarDoc && grammarDoc.grammar) {
      return { grammar: grammarDoc.grammar };
    }
  } catch (err) {
    console.log(err);
  }
  return { grammar: null };
};
