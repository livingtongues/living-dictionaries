import { deleteDocument, set, update } from '$sveltefire/firestore';
import type { IUser, IManager } from '$lib/interfaces';
import { arrayRemove, arrayUnion, serverTimestamp } from 'firebase/firestore';

export async function addDictionaryManagePermission(userBeingEdited: IUser, dictionaryId: string) {
  const manager: IManager = {
    id: userBeingEdited.uid,
    name: userBeingEdited.displayName,
  };

  await set(`dictionaries/${dictionaryId}/managers/${userBeingEdited.uid}`, manager);
  await update(`users/${userBeingEdited.uid}`, {
    managing: arrayUnion(dictionaryId),
    termsAgreement: serverTimestamp(),
  });
}

export async function removeDictionaryManagePermission(
  userBeingEdited: IUser,
  dictionaryId: string
) {
  if (
    confirm(`Are you sure you want to remove ${userBeingEdited.displayName} from ${dictionaryId}?`)
  ) {
    await deleteDocument(`dictionaries/${dictionaryId}/managers/${userBeingEdited.uid}`);
    await update(`users/${userBeingEdited.uid}`, {
      managing: arrayRemove(dictionaryId),
    });
  }
}
