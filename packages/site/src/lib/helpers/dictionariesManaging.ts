import { deleteDocument, deleteDocumentOnline, setOnline } from 'sveltefirets';
import type { IHelper } from '@living-dictionaries/types';
import { goto } from '$app/navigation';

export async function addDictionaryManager(manager: IHelper, dictionaryId: string) {
  await setOnline<IHelper>(`dictionaries/${dictionaryId}/managers/${manager.id}`, {
    id: manager.id,
    name: manager.name,
  });
}

export async function removeDictionaryManager(manager: IHelper, dictionaryId: string) {
  if (confirm(`Are you sure you want to remove ${manager.name} as manager from ${dictionaryId}?`)) {
    await deleteDocumentOnline(`dictionaries/${dictionaryId}/managers/${manager.id}`);
  }
}

export async function addDictionaryContributor(contributor: IHelper, dictionaryId: string) {
  await setOnline<IHelper>(`dictionaries/${dictionaryId}/contributors/${contributor.id}`, {
    id: contributor.id,
    name: contributor.name,
  });
}

export async function removeDictionaryContributor(contributor: IHelper, dictionaryId: string) {
  if (
    confirm(
      `Are you sure you want to remove ${contributor.name} as contributor from ${dictionaryId}?`
    )
  ) {
    await deleteDocument(`dictionaries/${dictionaryId}/contributors/${contributor.id}`);
  }
}

export async function removeDictionaryCollaborator(collaborator: IHelper, dictionaryId: string) {
  if (
    confirm(
      `Are you sure you want to remove ${collaborator.name} as write-in collaborator from ${dictionaryId}?`
    )
  ) {
    await deleteDocument(`dictionaries/${dictionaryId}/writeInCollaborators/${collaborator.id}`);
  }
}

export async function removeDictionary(dictionaryId: string) {
  const confirm = prompt('If you are sure about this, type the dictionary ID to confirm the complete deletion');
  if (confirm === dictionaryId) {
    await deleteDocumentOnline(`dictionaries/${dictionaryId}`);
    goto('/');
  } else if (confirm?.length > 0) {
    alert('Sorry the dictionary ID does not match what you typed');
  }
}
