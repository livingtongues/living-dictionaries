import { getDocument } from 'sveltefirets';
import type { IAbout } from '@living-dictionaries/types';

import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params, parent }) => {
  await parent();
  try {
    const aboutDoc = await getDocument<IAbout>(`dictionaries/${params.dictionaryId}/info/about`);
    if (aboutDoc && aboutDoc.about) {
      return { about: aboutDoc.about };
    }
  } catch (err) {
    console.log(err);
  }
  return { about: null };
};
