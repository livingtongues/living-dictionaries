import { deleteDocumentOnline, setOnline, updateOnline } from '$sveltefirets';
import { arrayRemove, arrayUnion, serverTimestamp } from 'firebase/firestore/lite';
import type { IUser, IManager } from '$lib/interfaces';

export async function addDictionaryManagePermission(userBeingEdited: IUser, dictionaryId: string) {
  const manager: IManager = {
    id: userBeingEdited.uid,
    name: userBeingEdited.displayName,
  };

  await setOnline(`dictionaries/${dictionaryId}/managers/${userBeingEdited.uid}`, manager);
  await updateOnline(`users/${userBeingEdited.uid}`, {
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
    await deleteDocumentOnline(`dictionaries/${dictionaryId}/managers/${userBeingEdited.uid}`);
    await updateOnline(`users/${userBeingEdited.uid}`, {
      managing: arrayRemove(dictionaryId),
    });
  }
}
