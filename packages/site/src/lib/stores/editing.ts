import { derived, type Readable } from 'svelte/store';
import { user } from './user';
import { dictionary_deprecated as dictionary } from './dictionary';
import { docExists } from 'sveltefirets';

export const isManager: Readable<boolean> = derived(
  [user, dictionary],
  ([$user, $dictionary], set) => {
    if ($user) {
      if ($user?.roles?.admin > 0) {
        set(true);
      } else {
        docExists(`dictionaries/${$dictionary.id}/managers/${$user.uid}`)
          .then((exists) => set(exists))
          .catch((err) => {
            console.error('Manager checking error: ', err);
          });
      }
    } else {
      set(false);
    }
  }
);

export const isContributor: Readable<boolean> = derived(
  [user, dictionary],
  ([$user, $dictionary], set) => {
    if ($user) {
      docExists(`dictionaries/${$dictionary.id}/contributors/${$user.uid}`)
        .then((exists) => set(exists))
        .catch((err) => {
          console.error('Contributor checking error: ', err);
        });
    } else {
      set(false);
    }
  }
);

export const canEdit: Readable<boolean> = derived(
  [isManager, isContributor],
  ([$isManager, $isContributor]) => $isManager || $isContributor
);
