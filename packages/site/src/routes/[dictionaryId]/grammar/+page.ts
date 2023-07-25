import { getDocument } from 'sveltefirets';
import type { IGrammar } from '@living-dictionaries/types';

import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params, parent }) => {
  await parent();
  try {
    const grammarDoc = await getDocument<IGrammar>(
      `dictionaries/${params.dictionaryId}/info/grammar`
    );
    if (grammarDoc?.grammar)
      return { grammar: grammarDoc.grammar };

  } catch (err) {
    alert(err);
  }
  return { grammar: null };
};
