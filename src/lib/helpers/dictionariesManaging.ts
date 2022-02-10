import { deleteDocumentOnline, setOnline, updateOnline } from '$sveltefirets';
import { arrayRemove, arrayUnion, serverTimestamp } from 'firebase/firestore/lite';
import type { IUser, IManager } from '$lib/interfaces';

export async function addDictionaryManagePermission(userBeingEdited: IUser, dictionaryId: string) {
  await setOnline<IManager>(`dictionaries/${dictionaryId}/managers/${userBeingEdited.uid}`, {
    id: userBeingEdited.uid,
    name: userBeingEdited.displayName,
  });
  await updateOnline<IUser>(`users/${userBeingEdited.uid}`, {
    //@ts-ignore
    managing: arrayUnion(dictionaryId),
    //@ts-ignore
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
