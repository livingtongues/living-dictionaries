import type { IUser } from '$lib/interfaces/user.interface';
import { firebaseConfig, createUserStore } from '$sveltefirets';

export const user = createUserStore<IUser>({
  userKey: `${firebaseConfig.projectId}_firebase_user`,
  log: true,
});
