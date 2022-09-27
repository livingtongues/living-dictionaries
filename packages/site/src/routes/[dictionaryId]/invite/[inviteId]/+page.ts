import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params, parent }) => {
  await parent();
  return {
    inviteId: params.inviteId,
  };
};
