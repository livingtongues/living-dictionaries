import { getDocument } from 'sveltefirets';
import type { IAbout } from '@living-dictionaries/types';
import { isManager } from '$lib/stores';

export const load = async ({ params, parent }) => {
  await parent();
  try {
    const aboutDoc = await getDocument<IAbout>(`dictionaries/${params.dictionaryId}/info/about`);
    return { about: aboutDoc?.about, isManager };
  } catch (err) {
    console.error(err);
    return { about: null, isManager };
  }
};
