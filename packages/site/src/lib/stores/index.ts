import { user } from './user';
import { admin } from './admin';
import { isManager, isContributor, canEdit } from './editing';

import { myDictionaries } from './dictionaries';
import { dictionary, entries } from './dictionary';
import { preferredColumns } from './columns';
import { algoliaQueryParams } from './search';

export {
  user,
  admin,
  isManager,
  isContributor,
  canEdit,
  myDictionaries,
  dictionary,
  entries,
  preferredColumns,
  algoliaQueryParams,
};
