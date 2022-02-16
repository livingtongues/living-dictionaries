import {
  deleteDocument,
  deleteDocumentOnline,
  getDocument,
  setOnline,
  updateOnline,
} from '$sveltefirets';
import { arrayRemove, arrayUnion, serverTimestamp } from 'firebase/firestore/lite';
import type { IUser, IManager, IWriteInCollaborator, IContributor } from '$lib/interfaces';

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

export async function removeDictionaryManagerPermission(
  userBeingEdited: IUser,
  dictionaryId: string
) {
  if (
    confirm(
      `Are you sure you want to remove ${userBeingEdited.displayName} as manager from ${dictionaryId}?`
    )
  ) {
    await deleteDocumentOnline(`dictionaries/${dictionaryId}/managers/${userBeingEdited.uid}`);
    await updateOnline(`users/${userBeingEdited.uid}`, {
      managing: arrayRemove(dictionaryId),
    });
  }
}
export async function addDictionaryContributorPermission(
  userBeingEdited: IUser,
  dictionaryId: string
) {
  const contributor: IContributor = {
    id: userBeingEdited.uid,
    name: userBeingEdited.displayName,
  };
  await setOnline(`dictionaries/${dictionaryId}/contributors/${contributor.id}`, contributor);
}

export async function removeDictionaryContributorPermission(
  contributorId: string,
  dictionaryId: string
) {
  const contributor: IContributor = await getDocument(
    `dictionaries/${dictionaryId}/contributors/${contributorId}`
  );
  if (
    confirm(
      `Are you sure you want to remove ${contributor.name} as contributor from ${dictionaryId}?`
    )
  ) {
    await deleteDocument(`dictionaries/${dictionaryId}/contributors/${contributorId}`);
  }
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
    confirm(
      `Are you sure you want to remove ${collaborator.name} as write-in collaborator from ${dictionaryId}?`
    )
  ) {
    await deleteDocument(`dictionaries/${dictionaryId}/writeInCollaborators/${collaboratorId}`);
  }
}
