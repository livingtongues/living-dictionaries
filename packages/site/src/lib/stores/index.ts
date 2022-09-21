import { user } from './user';
import { admin } from './admin';
import { isManager, isContributor, canEdit } from './editing';

import { myDictionaries } from './dictionaries';
import { dictionary, entries } from './dictionary';
import { columns, preferredColumns } from './columns';
import { algoliaQueryParams } from './search';
import { preferredPrintFields } from './print';

export {
  user,
  admin,
  isManager,
  isContributor,
  canEdit,
  myDictionaries,
  dictionary,
  entries,
  columns,
  preferredColumns,
  algoliaQueryParams,
  preferredPrintFields,
};
