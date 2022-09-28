import { getDocument } from 'sveltefirets';
import type { ICitation } from '@living-dictionaries/types';

import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params, parent }) => {
  await parent();
  try {
    const grammarDoc = await getDocument<ICitation>(
      `dictionaries/${params.dictionaryId}/info/citation`
    );
    if (grammarDoc && grammarDoc.citation) {
      return { citation: grammarDoc.citation };
    }
  } catch (err) {
    console.log(err);
  }
  return { citation: null };
};
