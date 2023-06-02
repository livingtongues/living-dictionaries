import type { Readable } from 'svelte/store';
import type { IDictionary, IHelper, IInvite } from '@living-dictionaries/types';

type DictionaryWithHelperStores = IDictionary & {
  managers: Readable<IHelper[]>;
  contributors: Readable<IHelper[]>;
  writeInCollaborators: Readable<IHelper[]>;
  invites: Readable<IInvite[]>;
};

type DictionaryWithHelpers = IDictionary & {
  managers: IHelper[];
  contributors: IHelper[];
  writeInCollaborators: IHelper[];
  invites: IInvite[];
};