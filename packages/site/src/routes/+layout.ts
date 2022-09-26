import { loadLocaleOnClient } from '$lib/i18n';
import { browser } from '$app/environment';
import type { LayoutLoad } from './$types';
export const load: LayoutLoad = async ({ data }) => {
  if (browser) {
    await loadLocaleOnClient();
  }
  return {
    user: data.user,
  };
};
