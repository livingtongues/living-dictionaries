import * as functions from 'firebase-functions';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs';
// import * as fs from 'fs-extra'; //"fs-extra": "^8.1.0", // "@types/fs-extra": "^5.0.4",
import * as csv from 'csvtojson';
import * as xlsx from 'xlsx'; // "xlsx": "^0.16.0"
const unzipper = require('unzipper'); // "unzipper": "^0.10.5",
import { fetchAsText } from 'fetch-as'; // "fetch-as": "^0.6.0",

import { storage, timestamp, db } from '../config';
// import { IImport, IEntry } from '../../../src/app/_common/interfaces';

import { convertOldTDKeyNames } from './td-converters';
const dataFileFormats = ['csv', 'json', 'xlsx'];
const imageFileFormats = ['jpg', 'jpeg'];
const audioFileFormats = ['mp3', 'wav'];

/**
 * Process dictionary spreadsheets or zipped packages upon import
 */
export const processImport = functions
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .firestore.document('dictionaries/{dictionaryId}/imports/{importId}')
  .onCreate(async (snapshot, context) => {
    try {
      // Make function idempotent, see https://cloud.google.com/blog/products/serverless/cloud-functions-pro-tips-building-idempotent-functions
      const importDoc = await snapshot.ref.get();
      if (importDoc.data().idempotency_key) {
        console.log('Exiting function because it already ran');
        return false;
      }
      if (
        process.env &&
        process.env.USERDOMAIN !== 'Laptop-name' &&
        importDoc.data().createdByName === 'Local Import'
      ) {
        return false;
      } //  keep local runs from also being picked up by the server

      // Initialize
      await updateImportDoc(
        { status: 'processing', idempotency_key: context.eventId },
        snapshot.ref
      );
      const snapData = snapshot.data();
      const dictionaryId = context.params.dictionaryId;
      const importId = context.params.importId;
      const env = functions.config().project.key.split('-').pop(); // ('dev' or 'alpha')

      // Determine file extension and unzip if necessary
      const importedFileExt = fileExtension(snapData.path);
      let dataFileExt: string;
      let dataFilePath: string;
      if (importedFileExt === 'zip') {
        // TODO: Validate data file is good to go
        // TODO: Validate that image and audio references correspond to actual images/audio as we want to throw an error immediately before saving all their audio and image files to storage
        // TODO: Validate that they only included one data file (dataFileFormats.includes(fileExt))
        dataFileExt = await unzipImportedArchive(snapData, dictionaryId);
        dataFilePath = snapData.path.replace('zip', dataFileExt);
      } else {
        dataFileExt = importedFileExt;
        dataFilePath = snapData.path;
      }
      if (!dataFileFormats.includes(dataFileExt)) {
        throw new Error(
          'No dictionary file found (*.csv, *.json, or *.xslx). Please resubmit import with one included.'
        );
      }

      // Save data file to temporary folder
      const tmpDataFilePath = join(tmpdir(), `${snapData.id}.${dataFileExt}`);
      await storage.bucket().file(dataFilePath).download({ destination: tmpDataFilePath });

      // Process and upload data to Firestore, images/audio to Storage
      let jsonData = await parseDataToJSON(tmpDataFilePath, dataFileExt);
      if (dataFileExt === 'json') {
        jsonData = convertOldTDKeyNames(jsonData);
      }
      const entryCount = await processAndUploadData(
        jsonData,
        dictionaryId,
        importId,
        importedFileExt,
        dataFileExt,
        snapData.createdBy,
        env
      );

      await fs.unlink(tmpDataFilePath, (err) => console.log(err)); // Clean up temporary storage
      return await updateImportDoc({ status: 'success', entryCount }, snapshot.ref);
    } catch (error) {
      return await updateImportDoc({ status: 'error', error: error.message }, snapshot.ref);
    }
  });

/**
 * Iterate through jsonData, calling transformJsonRow and uploading returned entry to Firestore
 */
export const processAndUploadData = async (
  jsonData: [],
  dictionaryId: string,
  importId: string,
  importedFileExt: string,
  dataFileExt: string,
  uid: string,
  env: string
) => {
  let entryCount = 0;
  let batchCount = 0;
  let skippedCSVExplanationRow = false;
  let batch = db.batch();
  const colRef = db.collection(`dictionaries/${dictionaryId}/words`);

  for (const row of jsonData) {
    // learned from https://lavrton.com/javascript-loops-how-to-handle-async-await-6252dd3c795/
    // if (entryCount > 100) { break } // to incrementally test larger and larger imports
    if (!skippedCSVExplanationRow && dataFileExt !== 'json') {
      skippedCSVExplanationRow = true;
      continue; // skips explanation header row in CSV/XLSX template
    } else {
      entryCount++;
    }

    const entry = await transformJsonRow(
      row,
      dictionaryId,
      importId,
      importedFileExt,
      dataFileExt,
      entryCount,
      uid,
      env
    );

    // add timestamps and creator metadata
    entry.createdAt = timestamp;
    entry.createdBy = uid;
    entry.updatedAt = timestamp;
    entry.updatedBy = uid;
    entry.importId = importId;

    if (batchCount === 200) {
      console.log('committing batch ending with entry: ', entryCount);
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
    batch.create(colRef.doc(), entry);
    batchCount++;
  }
  await batch.commit();
  return entryCount;
};

/**
 * Return entry object from each JSON row object
 */
export const transformJsonRow = async (
  row: any,
  dictionaryId: string,
  importId: string,
  importedFileExt: string,
  dataFileExt: string,
  lineNumber: number,
  uid: string,
  env: string
) => {
  // validate for required elements // TODO: remove once pre-processing validation is in place
  if (dataFileExt !== 'json' && !row.lexeme)
    throw new Error(`No lexeme found for row ${lineNumber + 2}`);
  // The first row is programmatically 0 but to the user it is row 2 since row 1 is column headings

  // build surrogate object
  //@ts-ignore
  const entry: IEntry = { lx: '', gl: {} };

  Object.keys(row).forEach((key) => {
    // Gloss and sentence columns are labeled using bcp47 language codes followed by '_gloss' or '_exampleSentence' (e.g. es_gloss, tpi_gloss)
    if (key.includes('_gloss') && row[key]) {
      const language = key.split('_gloss')[0];
      {
        entry.gl[language] = row[key];
      }
    }

    // Sentence columns are labeled similar to glosses (e.g. vernacular_exampleSentence, en_exampleSentence, es_exampleSentence, etc.)
    if (key.includes('_exampleSentence') && row[key]) {
      entry.xs = {};
      const language = key.split('_exampleSentence')[0];
      {
        entry.xs[language] = row[key];
      }
    }
  });

  // preprocess collections in single column inputs (pipe separated standard)
  Boolean(row.semanticDomain_custom) &&
    (() => {
      entry.sd = processMultiItemString(row.semanticDomain_custom);
    })();

  Boolean(row.lexeme) && (entry.lx = row.lexeme);
  Boolean(row.localOrthography) && (entry.lo = row.localOrthography);
  Boolean(row.phonetic) && (entry.ph = row.phonetic.replace(/[[\]]/g, '')); // Strip surrounding brackets if they are present in phonetic value
  Boolean(row.morphology) && (entry.mr = row.morphology);
  Boolean(row.interlinearization) && (entry.in = row.interlinearization);
  Boolean(row.partOfSpeech) && (entry.ps = row.partOfSpeech);
  Boolean(row.dialect) && (entry.di = row.dialect);
  Boolean(row.sdn) && (entry.sdn = row.sdn);
  Boolean(row.notes) && (entry.nt = row.notes);

  // process associated images and audio if data came in as part of a zip archive
  if (importedFileExt === 'zip') {
    if (row.soundFile) {
      // if old Talking Dictionary then check if sound file is in place first, for new imports, we're going to kick an error to tell the user to fix their audio references, but for the old Talking Dictionaries, there's too many missing audio files to throw errors on each and expect us to fix the references. We need to just skip over the missing files as we're not going to be able to find them anyways.
      if (dataFileExt === 'json') {
        try {
          const audioExists = await storage
            .bucket()
            .file(`${dictionaryId}/audio/import_${importId}/${sanitizeFileName(row.soundFile)}`)
            .exists();
          if (audioExists[0]) {
            entry.sf = {
              path: `${dictionaryId}/audio/import_${importId}/${sanitizeFileName(row.soundFile)}`,
              source: `import: ${importId}`,
              ts: timestamp,
              ab: uid,
              speakerName: row.authority || null,
            };
          } else {
            console.log(row.soundFile, ' audio does not exist for: ', row.lexeme);
          }
        } catch (err) {
          throw new Error(err);
        }
      } else {
        entry.sf = {
          path: `${dictionaryId}/audio/import_${importId}/${sanitizeFileName(row.soundFile)}`,
          source: `import: ${importId}`,
          ts: timestamp,
          ab: uid,
        };
      }
    }

    if (row.photoFile) {
      if (dataFileExt === 'json') {
        // old Talking Dictionaries
        try {
          const imageExists = await storage
            .bucket()
            .file(`${dictionaryId}/images/import_${importId}/${sanitizeFileName(row.photoFile)}`)
            .exists();
          if (imageExists[0]) {
            const imageStoragePath = `${dictionaryId}/images/import_${importId}/${sanitizeFileName(
              row.photoFile
            )}`;
            const url = await getImageServingUrl(imageStoragePath, env);
            entry.pf = {
              path: imageStoragePath,
              gcs: url,
              source: `import: ${importId}`,
              ts: timestamp,
              ab: uid,
            };
          } else {
            console.log(row.photoFile, ' image does not exist for: ', row.lexeme);
          }
        } catch (err) {
          throw new Error(err);
        }
      } else {
        const imageStoragePath = `${dictionaryId}/images/import_${importId}/${sanitizeFileName(
          row.photoFile
        )}`;
        const url = await getImageServingUrl(imageStoragePath, env);
        if (typeof url !== 'string') {
          throw new Error(`A valid URL was not returned for one of your images`);
        }
        entry.pf = {
          path: imageStoragePath,
          gcs: url,
          source: `import: ${importId}`,
          ts: timestamp,
          ab: uid,
        };
      }
    }
  }
  return entry;
};

/**
 * Process multi-part entries with pipe as separator
 */
export const processMultiItemString = (pipedString: string) => {
  if (!pipedString) return [];
  if (pipedString.includes('|')) {
    return pipedString.split('|');
  }
  return [pipedString];
};

export const getImageServingUrl = async (imageStoragePath: string, env: string) => {
  const storagePath = `${processImageUrl}/talking-dictionaries-${env}.appspot.com/${imageStoragePath}`;
  console.log('fetching: ', storagePath);
  const imageServingUrl = await fetchAsText(storagePath);
  // console.log(imageServingUrl.status, imageServingUrl.data) // status should = 200
  return imageServingUrl.data.replace('http://lh3.googleusercontent.com/', '');
};

/**
 * Accept data file saved to tmp folder and return parsed JSON objects in an array
 */
export const parseDataToJSON = async (tmpDataFilePath: string, dataFileExt: string) => {
  if (dataFileExt === 'csv') {
    return await csv().fromFile(tmpDataFilePath);
  } else if (dataFileExt === 'xlsx') {
    return convertXlsxToJson(tmpDataFilePath);
  } else if (dataFileExt === 'json') {
    return await fs.readJson(tmpDataFilePath);
  }
};

/**
 * Takes an Excel file and return the first sheet as an array of JSON objects for each row
 */
export const convertXlsxToJson = (tmpDataFilePath: string) => {
  const workbook = xlsx.readFile(tmpDataFilePath);
  const sheet_name_list = workbook.SheetNames;
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
};

/**
 * Update the import document, including a timestamp and memory usage
 */
export const updateImportDoc = async (update: any, ref: FirebaseFirestore.DocumentReference) => {
  const memory = process.memoryUsage(); // See https://stackoverflow.com/questions/12023359/what-do-the-return-values-of-node-js-process-memoryusage-stand-for
  const memoryUsage: any = {
    residentSetSize: `${Math.round((memory.rss / 1024 / 1024) * 100) / 100} MB`,
    heapTotal: `${Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100} MB`,
    heapUsed: `${Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100} MB`,
  };
  //@ts-ignore
  const data: IImport = {
    ...update,
    updatedAt: timestamp,
    memoryUsage,
  };
  console.log('updateImportDoc with: ', data);
  await ref.update(data);
  return update.error ? false : true;
};

// export const waitForPromise = async () => {
//     const startTime = Date.now();
//     await new Promise((resolve, reject) => {
//         setTimeout(() => resolve('Resolved Unzip Test'), 1000);
//         // reject(`Rejected Unzip Test`);
//     })
//     const endTime = Date.now();
//     console.log(endTime - startTime, ' seconds elapsed')
//     return true;
// }

/**
 * Unzip file archive in Firebase Storage which contains a dictionary file and optional images and audio folders
 */

//@ts-ignore
export const unzipImportedArchive = async (snapData: IImport, dictionaryId: string) => {
  let dataFileType = '';
  let audioFileCount = 0;
  let imageFileCount = 0;

  await new Promise((resolve, reject): any => {
    storage
      .bucket()
      .file(snapData.path)
      .createReadStream()
      // parse the stream with an unzip
      .pipe(unzipper.Parse())
      // with each file parsed, create output path to extract to
      .on('entry', (entry: any) => {
        if (entry.path && entry.type === 'File') {
          const fileName = entry.path.split('/').pop();
          const fileExt = fileExtension(entry.path);

          let fileRef;
          let contentType;

          // Note that audio/images and dictID have been flipped for a better file storage schema
          if (audioFileFormats.includes(fileExt.toLowerCase())) {
            // Handle audio
            fileRef = storage
              .bucket()
              .file(`${dictionaryId}/audio/import_${snapData.id}/${sanitizeFileName(fileName)}`);
            contentType = `audio/${fileExt}`;
            ++audioFileCount;
          } else if (imageFileFormats.includes(fileExt.toLowerCase())) {
            // Handle images
            fileRef = storage
              .bucket()
              .file(`${dictionaryId}/images/import_${snapData.id}/${sanitizeFileName(fileName)}`);
            contentType = `image/${fileExt}`;
            ++imageFileCount;
          } else if (dataFileFormats.includes(fileExt.toLowerCase())) {
            // Handle data file
            dataFileType = fileExt;
            fileRef = storage.bucket().file(`${snapData.path.replace('zip', fileExt)}`);
            contentType = 'text/plain';
          } else {
            console.log('No proper file type found for: ', fileName, ' - autodraining');
            entry.autodrain();
          }

          // pipe the entry into an output file
          entry.pipe(
            fileRef.createWriteStream({ metadata: { contentType, fileName }, resumable: false })
          ); // https://github.com/googleapis/google-cloud-node/issues/1154
        } else {
          entry.autodrain();
        }
      })
      .promise()
      .then(
        () => resolve(dataFileType),
        (e: Error) => reject(e)
      );
  });
  const startTime = Date.now();
  await new Promise((resolve) => {
    setTimeout(() => resolve('Wait for Files to register in Firebase Storage'), 10000);
  });
  console.log(
    `Paused ${
      Date.now() - startTime
    } milliseconds to let ${dataFileType} file, ${audioFileCount} audio files, and ${imageFileCount} image files register in Firebase Storage`
  );
  return dataFileType;
};

/**
 * Santize file name down to basic characters that can be accepted by Google's Serving Url generator
 * Use like this: `${dictionaryId}/audio/import_${importId}/${sanitizeFileName(filePath)}`
 */
export const sanitizeFileName = (fileName: string): string => {
  return fileName.replace(/[^a-z0-9.+]+/gi, '-');
};

/**
 * Return file extension
 */
export const fileExtension = (input: string) => {
  return input.split('.').pop();
};

// export const validateCSV = async (dictionaryPath: string) => {
//     await csv()
//         .fromFile(dictionaryPath)
//         .subscribe(async (row, lineNumber) => {
//             if (lineNumber > 0) { // skips explanation header row (row 2) in CSV template
//                 if (!row.lexeme) throw new Error(`No lexeme found for row ${lineNumber + 2}`);
//                 // The first row is programmatically 0 but to the user it is row 2 since row 1 is column headings
//             }
//         })
//     return true;
// }
