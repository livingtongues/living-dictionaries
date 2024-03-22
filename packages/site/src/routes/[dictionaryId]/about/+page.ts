import { getDocument } from 'sveltefirets';
import type { IAbout } from '@living-dictionaries/types';

export const load = async ({ params }) => {
  try {
    const aboutDoc = await getDocument<IAbout>(`dictionaries/${params.dictionaryId}/info/about`);
    return { about: aboutDoc?.about };
  } catch (err) {
    console.error(err);
    return { about: null };
  }
};
