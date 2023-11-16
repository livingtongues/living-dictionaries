import { redirect, error } from '@sveltejs/kit';
import type { IDictionary } from '@living-dictionaries/types';
import { getDocument } from 'sveltefirets';
import type { LayoutLoad } from './$types';
import { ErrorCodes } from '$lib/constants';

export const load: LayoutLoad = async ({ params: { dictionaryId } }) => {
  try {
    const dictionary = await getDocument<IDictionary>(`dictionaries/${dictionaryId}`);
    if (dictionary)
      return { dictionary };
  } catch (err) {
    throw error(ErrorCodes.INTERNAL_SERVER_ERROR, err);
  }
  throw redirect(ErrorCodes.MOVED_PERMANENTLY, '/');
};
