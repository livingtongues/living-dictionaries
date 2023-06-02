import type { Readable } from 'svelte/store';
import type { IDictionary, IHelper, IInvite } from '@living-dictionaries/types';

type DictionaryWithHelpers = IDictionary & {
  managers: Readable<IHelper[]>;
  contributors: Readable<IHelper[]>;
  writeInCollaborators: Readable<IHelper[]>;
  invites: Readable<IInvite[]>;
};