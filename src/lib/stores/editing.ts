import { derived } from 'svelte/store';
import type { Readable } from 'svelte/store';
import { user } from '$sveltefire/user';
import { dictionary } from './dictionary';
import { docExists } from '$sveltefire/firestore';

export const isManager: Readable<boolean> = derived(
  [user, dictionary],
  ([$user, $dictionary], set) => {
    if ($user) {
      // @ts-ignore
      if ($user.roles && $user.roles.admin && $user.roles.admin > 0) {
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
