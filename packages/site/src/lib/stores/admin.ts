import type { IUser } from '@living-dictionaries/types';
import { user } from './user';
import { derived } from 'svelte/store';

export const admin = derived(user, ($user: IUser) => {
  return $user?.roles?.admin || 0;
});
