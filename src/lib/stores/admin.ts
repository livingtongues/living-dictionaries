import type { IUser } from '$lib/interfaces';
import { user } from '$sveltefire/user';
import { derived } from 'svelte/store';

export const admin = derived(user, ($user: IUser) => {
  if ($user && $user.roles && $user.roles.admin && $user.roles.admin > 0) {
    return $user.roles.admin;
  } else {
    return false;
  }
});
