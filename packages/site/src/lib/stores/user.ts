import type { IUser } from '@living-dictionaries/types/user.interface';
import { createUserStore } from 'sveltefirets';
import { firebaseConfig } from '$lib/firebaseConfig';

export const user = createUserStore<IUser>({
  userKey: `${firebaseConfig.projectId}_firebase_user`,
  log: true,
});
