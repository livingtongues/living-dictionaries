// /// <reference types="jest" />
// import { IImport } from '../../../src/app/_common/interfaces';

// import { testFun } from '../test-config';
// testFun.cleanup;

// import { mockDictionary, mockImport } from './mocks';
// import { processImport, fileExtension, unzipImportedArchive, convertXlsxToJson, parseDataToJSON, processAndUploadData } from '../../src/import/importing';

// const dictionaryName: any = null //'remo';
// const testId = Date.now();
// const dictionaryId = `dictionary-test-${testId}`;
// const importId = `import-test-${testId}`;

// import * as fs from 'fs-extra';
// const util = require('util');
// const logFile = fs.createWriteStream(`./tests/logs/import-test-${testId}.txt`, { flags: 'w' }); // 'a' to append, 'w' to write over file contents
// const logStdout = process.stdout;
// console.log = function () {
//     logFile.write(util.format.apply(null, arguments) + '\n');
//     logStdout.write(util.format.apply(null, arguments) + '\n');
// }

// test('processImport cloud function activates onCreate and correctly parses and uploads data', async () => {
//     jest.setTimeout(4000000);

//     await mockDictionary(dictionaryId, testId, dictionaryName);
//     const importDoc: IImport = await mockImport(dictionaryId, importId, 'json-zip', dictionaryName); // 'csv' 'csv-zip' 'json' 'json-zip'

//     const importDocPath = `dictionaries/${dictionaryId}/imports/${importId}`;

//     const snap = testFun.firestore.makeDocumentSnapshot(importDoc, importDocPath);

//     const wrapped = testFun.wrap(processImport);
//     const result = await wrapped(snap, {
//         params: {
//             dictionaryId,
//             importId
//         }
//     });

//     expect(result).toBeTruthy();
// });

// // Test TODO: check that updateImportDoc works properly on success and error

// test.skip('fileExtension recognizes file types properly', () => {
//     expect.assertions(4);
//     expect(fileExtension(`imports/${dictionaryId}/${importId}.zip`)).toBe('zip');
//     expect(fileExtension(`imports/${dictionaryId}/${importId}.csv`)).toBe('csv');
//     expect(fileExtension(`imports/${dictionaryId}/${importId}.xlsx`)).toBe('xlsx');
//     expect(fileExtension(`imports/${dictionaryId}/${importId}.json`)).toBe('json');
// })

// test.skip('unzipImportedArchive properly returns data file type', async () => {
//     const dataFileType = await unzipImportedArchive({ path: `imports/${dictionaryId}/${importId}.zip`, id: importId }, dictionaryId);
//     expect(dataFileType).toBe('csv');
// })

// test.skip('parseDataToJSON returns array of objects from all three data types with the first object containing a lexeme', async () => {
//     expect.assertions(3);
//     const csvJsonData = await parseDataToJSON('./tests/import/files/dictionary.csv', 'csv')
//     const xlsxJsonData = await parseDataToJSON('./tests/import/files/dictionary.xlsx', 'xlsx')
//     const tdJsonData = await parseDataToJSON('./tests/import/files/matukar_export_td.json', 'json')
//     // console.log(csvJsonData);
//     // console.log(xlsxJsonData);
//     // console.log(tdJsonData);
//     expect(csvJsonData[0].lexeme).toBeTruthy();
//     expect(xlsxJsonData[0].lexeme).toBeTruthy();
//     expect(tdJsonData[0].lang).toBeTruthy();
// })

// test.skip('processAndUploadData uploads successfully and returns an entryCount', async () => {
//     const jsonData = await parseDataToJSON('./tests/import/files/Tutelo-Saponi-v3-11.4.csv', 'csv')

//     // let entryCount = 0;
//     // jsonData.forEach(async (row: any) => {
//     //     entryCount++;
//     //     if (entryCount > 1) {
//     //         const entry = await transformJsonRow(row, dictionaryId, importId, 'csv', entryCount);
//     //         console.log(entry);
//     //     }
//     // });
//     const entryCount = await processAndUploadData(jsonData, dictionaryId, importId, 'csv', 'csv', 'uid', 'dev');
//     expect(entryCount).toBeGreaterThan(0);
// })

// test.skip('convertXlsxToJson returns an object', async () => {
//     const jsonData = convertXlsxToJson('./tests/import/files/dictionary.xlsx');
//     expect(jsonData).toBeInstanceOf(Object)
// })

// /**
// * getStoragePath sample-imports
// */
// // it('getStoragePath returns a path string containing these substrings', function () {
// //     const fileName = 'test.txt';
// //     const result = getStoragePath(fileName, importId, dictionaryId, timestamp);
// //     expect.assertions(4);
// //     expect(result).toBeDefined();
// //     expect(result).toContain(dictionaryId);
// //     expect(result).toContain(importId);
// //     expect(result).toContain(timestamp.toMillis());
// // })

// /**
// * transformJsonRow sample-imports
// */
// // test('transformJsonRow throws an error if object is empty', async () => {
// //     const row = {};
// //     const lineNumber = 3;
// //     expect.assertions(1);
// //     await expect(
// //         transformJsonRow(row, uid, timestamp, importId, dictionaryId, lineNumber)
// //     ).rejects.toThrow()
// // })

// // test('transformJsonRow does NOT throw if object has a lexeme', async () => {
// //     const row = { lexeme: 'welcome' };
// //     const lineNumber = 3;
// //     expect.assertions(1);
// //     await expect(
// //         transformJsonRow(row, uid, timestamp, importId, dictionaryId, lineNumber)
// //     ).resolves.toHaveProperty('lx')
// // })

// // test('transformJsonRow has a "createdAt" timestamp on creation', async () => {
// //     const row = { lexeme: 'welcome' };
// //     const lineNumber = 3;
// //     expect.assertions(1);
// //     await expect(
// //         transformJsonRow(row, uid, timestamp, importId, dictionaryId, lineNumber)
// //     ).resolves.toHaveProperty('createdAt')
// // })

// // test('transformJsonRow has a "source" property on creation', async () => {
// //     const row = { lexeme: 'welcome' };
// //     const lineNumber = 3;
// //     expect.assertions(1);
// //     await expect(
// //         transformJsonRow(row, uid, timestamp, importId, dictionaryId, lineNumber)
// //     ).resolves.toHaveProperty('source')
// // })

// // test('transformJsonRow reads and parses a JSON file row from a sequential list if file contains "rows" object property', async () => {
// //     const jsonData = JSON.parse(fs.readFileSync('./tests/import/files/testdictionary_rop.json'));
// //     let count = 2;
// //     const ERRORS = [];
// //     for (const row of jsonData.rows) {
// //         expect.assertions(2);
// //         try {
// //             await expect(
// //                 transformJsonRow(row, uid, timestamp, importId, dictionaryId, count)
// //             )
// //                 .resolves.toHaveProperty('lx')
// //             ++count;
// //         } catch (err) {
// //             ERRORS.push(err)
// //         } finally {
// //             if (ERRORS.length > 0) { console.log(ERRORS) }
// //         }
// //     }
// // })

// /**
// * transformTDJsonRow sample-imports
// */
// // test('transformTDJsonRow reads and parses a TD formatted JSON file row from a matukar export file containing ONLY an array of 4151 objects', async () => {
// //     const jsonData = JSON.parse(fs.readFileSync('./tests/import/files/matukar_export_td.json'));
// //     let count = 0;
// //     const ERRORS = [];
// //     for (const row of jsonData) {
// //         expect.assertions(4152);
// //         try {
// //             await expect(
// //                 transformTDJsonRow(row, uid, timestamp, importId, dictionaryId, count)
// //             )
// //                 .resolves.toHaveProperty('lx')
// //             ++count;
// //         } catch (err) {
// //             ERRORS.push(err)
// //         } finally {
// //             if (ERRORS.length > 0) { console.log(ERRORS) }
// //         }
// //     }
// //     expect(count).toEqual(4151);
// // })

// // test('transformTDJsonRow reads and parses a TD formatted JSON file row from a siletz export file containing ONLY an array of 10549 objects', async () => {
// //     const jsonData = JSON.parse(fs.readFileSync('./tests/import/files/siletz_export_td.json'));
// //     let count = 0;
// //     const ERRORS = [];
// //     for (const row of jsonData) {
// //         expect.assertions(10550);
// //         try {
// //             await expect(
// //                 transformTDJsonRow(row, uid, timestamp, importId, dictionaryId, count)
// //             )
// //                 .resolves.toHaveProperty('lx')
// //             ++count;
// //         } catch (err) {
// //             ERRORS.push(err)
// //         } finally {
// //             if (ERRORS.length > 0) { console.log(ERRORS) }
// //         }
// //     }
// //     expect(count).toEqual(10549);
// // })

// /**
// * getFileRefAndContentType sample-imports
// */
// // describe.skip('expect getFileRefAndContentType', function () {
// //     const bucketInstance = storage.bucket('test');
// //     const entry = { file: './tests/import/files/dictionary.csv' };
// //     const archiveDir = '160012345678';
// //     it('to return an object with two properties', () => {
// //         expect.assertions(5);
// //         const result = getFileMeta(bucketInstance, entry, archiveDir, timestamp, importId, dictionaryId)
// //         expect(result).toBeDefined();
// //         expect(result).toBeTruthy();
// //         expect(result).toHaveProperty('fileRef');
// //         expect(result).toHaveProperty('contentType');
// //         expect(result).toHaveProperty('dictionaryFormatIdx');
// //     })
// // })

// /**
//  * validateCSV
//  */
// // test('validateCSV returns an object', async () => {
// //     const dictionaryPath = './tests/import/files/dictionary.csv';
// //     expect(await validateCSV(uid, dictionaryPath, timestamp, importId, dictionaryId))
// //         .toBeInstanceOf(Object)
// // })

// // test('validateCSV returns an object even when given invalid data', async () => {
// //     const dictionaryPath = './tests/import/files/dictionaryERRORS.csv';
// //     expect(await validateCSV(uid, dictionaryPath, timestamp, importId, dictionaryId))
// //         .toBeInstanceOf(Object)
// // })

// // test('validateCSV returns an object with an ERRORS property and length 2', async () => {
// //     const dictionaryPath = './tests/import/files/dictionaryERRORS.csv';
// //     expect.assertions(2);
// //     const result = await validateCSV(uid, dictionaryPath, timestamp, importId, dictionaryId)
// //     expect(result).toHaveProperty('ERRORS')
// //     expect(result.ERRORS).toHaveLength(1)
// // })
