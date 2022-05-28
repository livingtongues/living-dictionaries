import { db } from '../config';
import { IDictionary } from '@living-dictionaries/types';
/**
 * Create new empty dictionary in Firestore
 */
export const mockDictionary = async (dictionaryId: string, glossLanguages: string[]) => {
  const dictionaryDoc: IDictionary = {
    id: `${dictionaryId}`,
    name: `${dictionaryId}`,
    public: true,
    entryCount: 0,
    glossLanguages, //: ['en', 'es', 'hi', 'or'],
  };
  await db.doc(`dictionaries/${dictionaryId}`).set(dictionaryDoc);
  return dictionaryDoc;
};
