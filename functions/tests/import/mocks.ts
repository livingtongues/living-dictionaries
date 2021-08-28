// import { db, storage, timestamp } from '../../src/config';
// import { IImport, IDictionary } from '../../../src/app/_common/interfaces';

// /**
//  * Create new empty dictionary in Firestore
//  */
// export const mockDictionary = async (dictionaryId: string, testId: number, dictionaryName?: string) => {
//     const dictionaryDoc: IDictionary = {
//         id: dictionaryId,
//         name: `Test Dictionary: ${dictionaryName ? dictionaryName : testId}`,
//         createdBy: 'Jest Test',
//         createdAt: timestamp,
//         updatedBy: 'Jest Test',
//         updatedAt: Date.now(),
//         public: false,
//         entryCount: 0,
//         glossLanguages: ['en', 'es', 'hi', 'or'],
//     };
//     await db.doc(`dictionaries/${dictionaryId}`).set(dictionaryDoc);
//     return dictionaryDoc;
// }

// /**
//  * Mock import by uploading import file and calling function to save import doc to Firestore
//  */
// export const mockImport = async (dictionaryId: string, importId: string, type: 'csv' | 'json' | 'csv-zip' | 'json-zip', dictionaryName?: string) => {
//     let fileExt: 'csv' | 'json' | 'zip' = 'csv';

//     if (dictionaryName) {
//         fileExt = 'zip';
//         await storage.bucket().upload(`${dictionaryName}/${dictionaryName}_content_full.zip`, { destination: `${dictionaryId}/imports/${importId}.zip` });
//     } else if (type === 'csv') {
//         const storagePath = `${dictionaryId}/imports/${importId}.${fileExt}`;
//         await storage.bucket().upload('./tests/import/files/td-v1/wahgi_export.json', { destination: storagePath });
//     } else if (type === 'csv-zip') {
//         fileExt = 'zip';
//         const storagePath = `${dictionaryId}/imports/${importId}.${fileExt}`;
//         await storage.bucket().upload('./tests/import/files/v3-csv-template-with-3-audio-1-image-files.zip', { destination: storagePath });
//         // v3-csv-template-with-3-audio-files.zip
//     } else if (type === 'json') {
//         fileExt = 'json';
//         const storagePath = `${dictionaryId}/imports/${importId}.${fileExt}`;
//         await storage.bucket().upload('./tests/import/files/quechua_chanka-old-TD-export-with-188-audio-200-entries.json', { destination: storagePath });
//     } else if (type === 'json-zip') {
//         fileExt = 'zip';
//         const storagePath = `${dictionaryId}/imports/${importId}.${fileExt}`;
//         await storage.bucket().upload('./tests/import/files/td-v1/remo_content_full.zip', { destination: storagePath });
//     }
//     console.log('import uploaded')
//     return await saveImportDoc(dictionaryId, importId, fileExt);
// }

// /**
//  * Create new Firestore import data file
//  */
// export const saveImportDoc = async (dictionaryId: string, importId: string, fileExt: 'csv' | 'json' | 'zip') => {
//     const importDoc: IImport = {
//         id: importId,
//         path: `${dictionaryId}/imports/${importId}.${fileExt}`,
//         createdByName: 'Local Import',
//         createdBy: Date.now().toString(),
//         createdAt: Date.now(),
//         // createdAt: testingTimestamp,
//         // Cannot encode [object Object]to a Firestore Value. Local testing does not yet support Firestore geo points.
//         updatedBy: Date.now().toString(),
//         // updatedAt: timestamp,
//         updatedAt: Date.now(),
//         status: 'uploaded',
//     };
//     await db.doc(`dictionaries/${dictionaryId}/imports/${importId}`).set(importDoc);
//     return importDoc;
// }
