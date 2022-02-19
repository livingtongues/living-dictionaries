import { deleteDocument, deleteDocumentOnline, setOnline } from '$sveltefirets';
import type { IUser, IHelper } from '$lib/interfaces';

export async function addDictionaryManager(helper: IHelper, dictionaryId: string) {
  await setOnline<IHelper>(`dictionaries/${dictionaryId}/managers/${helper.id}`, {
    id: helper.id,
    name: helper.name,
  });
}

export async function removeDictionaryManager(user: IUser, dictionaryId: string) {
  if (
    confirm(`Are you sure you want to remove ${user.displayName} as manager from ${dictionaryId}?`)
  ) {
    await deleteDocumentOnline(`dictionaries/${dictionaryId}/managers/${user.uid}`);
  }
}

export async function addDictionaryContributorPermission(user: IUser, dictionaryId: string) {
  const contributor: IHelper = {
    id: user.uid,
    name: user.displayName,
  };
  await setOnline(`dictionaries/${dictionaryId}/contributors/${contributor.id}`, contributor);
}

export async function removeDictionaryContributorPermission(
  contributor: IHelper,
  dictionaryId: string
) {
  if (
    confirm(
      `Are you sure you want to remove ${contributor.name} as contributor from ${dictionaryId}?`
    )
  ) {
    await deleteDocument(`dictionaries/${dictionaryId}/contributors/${contributor.id}`);
  }
}

export async function removeDictionaryCollaboratorPermission(
  collaborator: IHelper,
  dictionaryId: string
) {
  if (
    confirm(
      `Are you sure you want to remove ${collaborator.name} as write-in collaborator from ${dictionaryId}?`
    )
  ) {
    await deleteDocument(`dictionaries/${dictionaryId}/writeInCollaborators/${collaborator.id}`);
  }
}
