import { deleteDocument, set, update, getDocument } from '$sveltefire/firestorelite';
import { arrayRemove, arrayUnion, serverTimestamp } from 'firebase/firestore/lite';
import type { IUser, IManager, IWriteInCollaborator } from '$lib/interfaces';

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

export async function addDictionaryCollaboratorPermission(
  userBeingEdited: IUser,
  dictionaryId: string
) {
  const collab: IWriteInCollaborator = {
    id: userBeingEdited.uid,
    name: userBeingEdited.displayName,
  };
  await set(`dictionaries/${dictionaryId}/writeInCollaborators/${userBeingEdited.uid}`, collab);
}

export async function removeDictionaryCollaboratorPermission(
  collaboratorId: string,
  dictionaryId: string
) {
  const collaborator: IWriteInCollaborator = await getDocument(
    `dictionaries/${dictionaryId}/writeInCollaborators/${collaboratorId}`
  );
  if (
    collaborator &&
    confirm(`Are you sure you want to remove ${collaborator.name} from ${dictionaryId}?`)
  ) {
    await deleteDocument(`dictionaries/${dictionaryId}/writeInCollaborators/${collaboratorId}`);
  }
}
