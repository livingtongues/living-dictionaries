import { redirect } from '@sveltejs/kit';

import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params }) => {
  throw redirect(308, `/${params.dictionaryId}/entry/${params.redirectId}`);
};
