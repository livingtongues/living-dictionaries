import type { IUser } from '@living-dictionaries/types';
import { user } from './user';
import { derived, type Readable } from 'svelte/store';

export const admin = derived<Readable<IUser>, number>(user, ($user: IUser) => {
  return $user?.roles?.admin || 0;
});
