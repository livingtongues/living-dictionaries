import { redirect } from '@sveltejs/kit';

import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params }) => {
  throw redirect(307, `/${params.dictionaryId}/entries/list`);
};
