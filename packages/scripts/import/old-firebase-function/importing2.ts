import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

import {
  FileFORMATS,
  transformJsonRow,
  transformTDJsonRow,
  unzipFirebaseArchive,
  validateCSV,
  processCSV,
  importXLS,
} from './libs/';

export const processImport = functions
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .firestore.document('dictionaries/{dictionaryId}/imports/{importId}')
  .onCreate(async (snapshot, context) => {
    const functionStart = Date.now();
    const importRef = snapshot.ref;
    let processStatus = `processing`;
    await importRef.update({
      status: processStatus,
    });
    const dictionaryId = context.params.dictionaryId;
    const colRef = db.collection(`dictionaries/${dictionaryId}/words`);
    let batch = db.batch();
    let stopcount = -1;
    let importCount = 0;
    const batchSize = 299;
    let validations: any = [];
    let processResults: any = {};
    //const processENV = context.resource.name.split('/')[1].split('-').pop();
    // gather elements from file upload to prepare for parsing
    const importId = context.params.importId;
    const snapData = await snapshot.data();
    const importFilePath = snapData.path;
    const timestamp = snapData.createdAt;
    const uid = snapData.createdBy;
    const fileOriginalName = importFilePath.split('/').pop();
    const fileOriginalExt = fileOriginalName.split('.').pop();
    let dictionaryPath = '';
    let isArchived = false;
    let isJSON = false;
    let isXLS = false;
    let isCSV = false;
    const bucketInstance = admin.storage().bucket();
    // let prepareDictionary = false;

    if (fileOriginalExt === 'zip') {
      // unzip archive first
      isArchived = true;
      const archiveDir = importFilePath.replace('.zip', '');
      const formatIdx = await unzipFirebaseArchive(
        bucketInstance,
        importFilePath,
        uid,
        timestamp,
        importId,
        dictionaryId
      );
      if (formatIdx < 0) {
        processStatus = `error`;
        await importRef.update({
          entryCount: 0,
          error: 'A dictionary manifest does not exist in this archive',
          memoryUsage: process.memoryUsage(),
          elapsedTime: `${Date.now() - functionStart}`,
          status: processStatus,
        });
        return 0;
      } else {
        const archiveManifest = `${archiveDir}/dictionary.${FileFORMATS[formatIdx]}`;
        dictionaryPath = path.join(os.tmpdir(), `dictionary.${FileFORMATS[formatIdx]}`);
        await bucketInstance.file(archiveManifest).download({ destination: dictionaryPath });
        // mark the format flag with a terse statement
        [
          () => {
            isCSV = true;
          },
          () => {
            isJSON = true;
          },
          () => {
            isXLS = true;
          },
        ][formatIdx]();
      }
    } else if (fileOriginalExt === 'csv') {
      // handle simple 'CSV' file upload
      isCSV = true;
      dictionaryPath = path.join(os.tmpdir(), fileOriginalName);
      await bucketInstance.file(importFilePath).download({ destination: dictionaryPath });
    } else if (fileOriginalExt === 'xlsx') {
      // handle simple 'XLSX' file upload
      isXLS = true;
      dictionaryPath = path.join(os.tmpdir(), fileOriginalName);
      await bucketInstance.file(importFilePath).download({ destination: dictionaryPath });
    } else if (fileOriginalExt === 'json') {
      // handle simple 'JSON' file upload
      isJSON = true;
      dictionaryPath = path.join(os.tmpdir(), fileOriginalName);
      await bucketInstance.file(importFilePath).download({ destination: dictionaryPath });
    } else {
      throw new Error(
        `UID: ${uid} -- no dictionary.csv or dictionary.json file found in archive or standalone, please resubmit with one included`
      );
    }

    if (isCSV) {
      // make a first pass through the csv and store errors in the validations collection variable
      validations = await validateCSV(uid, dictionaryPath, timestamp, importId, dictionaryId);
      if (validations.length > 0) {
        await importRef.update({
          error: JSON.stringify(validations),
        });
        processStatus = `error`;
      } else {
        processResults = await processCSV(
          db,
          uid,
          dictionaryPath,
          timestamp,
          importId,
          dictionaryId,
          isArchived
        );
        if (processResults.ERRORS && processResults.ERRORS.length > 0) {
          await importRef.update({
            error: JSON.stringify(processResults.ERRORS),
          });
          processStatus = `error`;
        } else {
          try {
            await importRef.update({
              entryCount: processResults.importCount,
              memoryUsage: process.memoryUsage(),
              elapsedTime: `${Date.now() - functionStart}`,
            });
            processStatus = `success`;
          } catch (err) {
            await importRef.update({
              error: 'errors while updating import status',
            });
            processStatus = `error`;
          }
        }
      } // if(validations.length>0)
      await importRef.update({
        entryCount: processResults.importCount,
        memoryUsage: process.memoryUsage(),
        elapsedTime: `${Date.now() - functionStart}`,
        status: processStatus,
      });
      importCount = processResults.importCount;
      return importCount;
    }

    let jsonData: any = [];

    if (isXLS) {
      // XLSX file parser
      jsonData = await importXLS(dictionaryPath);
    }
    if (isJSON) {
      // JSON file parser
      jsonData = JSON.parse(fs.readFileSync(dictionaryPath));
    }

    for (const entry of jsonData) {
      try {
        const entryId = colRef.doc().id;
        const docRef = colRef.doc(entryId);
        let row = {};
        if (isXLS) {
          row = await transformJsonRow(
            entry,
            uid,
            timestamp,
            importId,
            dictionaryId,
            importCount,
            isArchived
          );
        }
        if (isJSON) {
          // For importing old Talking Dictionaries
          row = await transformTDJsonRow(
            entry,
            uid,
            timestamp,
            importId,
            dictionaryId,
            importCount,
            isArchived
          );
        }
        batch.set(docRef, row);
      } catch (err) {
        validations.push(err);
      }
      if (stopcount === batchSize) {
        await batch.commit();
        batch = db.batch();
        stopcount = -1;
      }
      ++stopcount;
      ++importCount;
    }

    processStatus = `success`;
    await batch.commit();
    await importRef.update({
      entryCount: importCount,
      memoryUsage: process.memoryUsage(),
      elapsedTime: `${Date.now() - functionStart}`,
      status: processStatus,
    });
    return importCount;
  });
