import { redirect, error } from '@sveltejs/kit';
import type { IDictionary } from '@living-dictionaries/types';
import { getDocument } from 'sveltefirets';
import type { LayoutLoad } from './$types';
import { ResponseCodes } from '$lib/constants';

export const load: LayoutLoad = async ({ params: { dictionaryId } }) => {
  try {
    const dictionary = await getDocument<IDictionary>(`dictionaries/${dictionaryId}`);
    if (dictionary)
      return { dictionary };
  } catch (err) {
    // only thrown if there was a db error
    throw error(ResponseCodes.INTERNAL_SERVER_ERROR, err);
  }
  // reaches here if no dictionary
  throw redirect(ResponseCodes.MOVED_PERMANENTLY, '/');
};
