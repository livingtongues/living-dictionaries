import type { PageLoad } from './$types';
export const load: PageLoad = ({ params: { bcp} }) => {
  return { bcp };
};
