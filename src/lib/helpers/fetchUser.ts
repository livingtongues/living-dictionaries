import { getDocument } from '$sveltefire/firestore';
import type { IUser } from '$lib/interfaces';

export async function fetchUser(id: string): Promise<IUser> {
  const user = await getDocument<IUser>(`users/${id}`);
  return user;
}
