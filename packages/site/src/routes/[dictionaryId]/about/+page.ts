import { getDocument } from 'sveltefirets';
import type { IAbout } from '@living-dictionaries/types';

import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params, parent }) => {
  await parent();
  try {
    const aboutDoc = await getDocument<IAbout>(`dictionaries/${params.dictionaryId}/info/about`);
    if (aboutDoc?.about)
      return { about: aboutDoc.about };

  } catch (err) {
    console.error(err);
  }
  return { about: null };
};
