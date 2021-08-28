// import * as functions from 'firebase-functions';
import { fetchAsText } from 'fetch-as';
import { IEntry, IGloss, IExampleSentence } from '../../../src/lib/interfaces';
import * as csv from 'csvtojson';
import * as xlsx from 'xlsx';
const unzip = require('unzipper');

export const FileFORMATS = ['csv', 'json', 'xlsx'];

export function getStoragePath(
  fileName: string,
  importId: string,
  dictionaryId: string,
  timestamp
): string {
  const incomingName = fileName.split('/').pop();
  const fileTypeSuffix = fileName.split('.').pop();
  const suffixRemoved = incomingName.replace(`.${fileTypeSuffix}`, '');
  const sanitizedName = suffixRemoved.replace(/[^a-z0-9+]+/gi, '-');

  return `${dictionaryId}/import_${importId}/${sanitizedName}_${timestamp
    .toDate()
    .getTime()}.${fileTypeSuffix}`;
}

/*
    { status: 200,
  info: 
   { headers: 
      { 'access-control-allow-origin': '*',
        'alt-svc': 'quic=":443"; ma=2592000; v="46,43,39"',
        connection: 'close',
        'content-length': '120',
        'content-type': 'text/plain;charset=iso-8859-1',
        date: 'Thu, 22 Aug 2019 23:16:33 GMT',
        server: 'Google Frontend',
        'x-cloud-trace-context': '3a24064b65cc36d6b6cef050afe9b453;o=1' },
     timeout: 0,
     size: 0,
     type: undefined },
  data: 'http://lh3.googleusercontent.com/eddNCxNVI8cj33hK94U2a206QunLOjcNBPgF2T17JcHybUBVjV1FH13-Y-Ye9LhGVUheGNpNyiRlxOrMZeiPdw\n' }

*/
async function getImageServingUrl(
  imageStoragePath: string,
  environment: string,
  uid: string,
  attempt?: number
) {
  if (attempt > 2) {
    throw new Error(`getImageServingUrl too many retries`);
    return '';
  }
  try {
    const storagePath = `${processImageUrl}/talking-dictionaries-${
      environment === 'prod' ? 'alpha' : 'dev'
    }.appspot.com/${imageStoragePath}`;
    // TODO: Refactor in a better manner?
    const imageServingUrl = await fetchAsText(storagePath);
    if (imageServingUrl.status === 200 && imageServingUrl.data) {
      return imageServingUrl.data.replace('http://lh3.googleusercontent.com/', '');
    } else {
      setTimeout(() => {
        console.log(`retrying attempt: ${attempt}`);
      }, 1000);
      return await getImageServingUrl(imageStoragePath, environment, uid, attempt + 1 || 1);
      // throw new Error(`getImageServingUrl data not ready for storagePath: ${storagePath} with status ${imageServingUrlText.status}`)
    }
  } catch (err) {
    throw new Error(`getImageServingUrl outer catch -- UID: ${uid} -- ${err}`);
  }
}

// process multi part entries with pipe as separator
function processMultiItemString(pipedString) {
  if (!pipedString) return [];
  if (pipedString.includes('|')) {
    return pipedString.split('|');
  }
  return [pipedString];
}

// process multi column entries where the column names tie the related collection key
function extractCollectionValues(item: any[], keyColumnMatch: string) {
  if (Object.keys(item).join('').includes(keyColumnMatch)) {
    const output = {};
    Object.keys(item).forEach((key, indx, coll) => {
      if (key.includes(keyColumnMatch) && Boolean(item[key])) {
        output[key.split(keyColumnMatch)[0]] = item[key];
      } // switched to 0 from 1 for old Talking Dictionaries import as the order is flipped. We may flip the order of the new template too.
    });
    return output;
  }
  return {};
}

export function getFileMeta(
  bucketInstance: any,
  entry: any,
  archiveDir: string,
  timestamp: any,
  importId: string,
  dictionaryId: string
) {
  let fileRef = bucketInstance.file(`${archiveDir}/${entry.path}`);
  let contentType = 'text/plain';
  let dictionaryFormatIdx = -1;
  try {
    if (entry.path) {
      const fileName = entry.path.split('/').pop();
      dictionaryFormatIdx = FileFORMATS.indexOf(fileName.split('.').pop());
      if (entry.path.split('/')[0] === 'audio') {
        fileRef = bucketInstance.file(
          `audio/${getStoragePath(fileName, importId, dictionaryId, timestamp)}`
        );
        contentType = `audio/${entry.path.split('.').pop()}`;
      }
      if (entry.path.split('/')[0] === 'images') {
        fileRef = bucketInstance.file(
          `images/${getStoragePath(fileName, importId, dictionaryId, timestamp)}`
        );
        contentType = `image/${entry.path.split('.').pop()}`;
      }
    }
  } catch (err) {
    throw new Error(err);
  }

  return { fileRef, contentType, dictionaryFormatIdx };
}

export async function transformJsonRow(
  row: any,
  uid: string,
  timestamp: any,
  importId: string,
  dictionaryId: string,
  lineNumber: number,
  partOfArchive?: boolean
) {
  // validate for required elements
  if (!row.lexeme) throw new Error(`No lexeme found for row ${lineNumber + 2}`); // The first row is programmatically 0 but to the user it is row 2 since row 1 is column headings
  // build surrogate object
  const entryObject: IEntry = { lx: '', gl: {} };
  // add timestamps and creator metadata
  Boolean(timestamp) && (entryObject.createdAt = timestamp);
  Boolean(uid) && (entryObject.createdBy = uid);
  Boolean(timestamp) && (entryObject.updatedAt = timestamp);
  Boolean(uid) && (entryObject.updatedBy = uid);
  Boolean(importId) && (entryObject.source = `import: ${importId}`);

  // preprocess collections from gloss column keys (e.g. es_gloss, tpi_gloss, etc.)
  if (Object.keys(row).join('').includes('gloss')) {
    const gloss: IGloss = extractCollectionValues(row, '_gloss');
    entryObject.gl = gloss;
  }
  // preprocess collections from example sentence column keys (e.g. vernacular_exampleSentence, en_exampleSentence, es_exampleSentence, etc.)
  if (Object.keys(row).join('').includes('exampleSentence')) {
    const example: IExampleSentence = extractCollectionValues(row, '_exampleSentence');
    entryObject.xs = example;
  }
  // preprocess collections in single column inputs (pipe separated standard)
  Boolean(row.semanticDomain_custom) &&
    (() => {
      entryObject.sd = processMultiItemString(row.semanticDomain_custom);
    })();

  Boolean(row.lexeme) && (entryObject.lx = row.lexeme);
  Boolean(row.localOrthography) && (entryObject.lo = row.localOrthography);
  Boolean(row.phonetic) && (entryObject.ph = row.phonetic); // TODO: strip surrounding brackets if they are present in phonetic value
  Boolean(row.morphology) && (entryObject.mr = row.morphology);
  Boolean(row.interlinearization) && (entryObject.in = row.interlinearization);
  Boolean(row.partOfSpeech) && (entryObject.ps = row.partOfSpeech);
  Boolean(row.dialect) && (entryObject.di = row.dialect);
  Boolean(row.sd) && (entryObject.sd = row.sdn);
  Boolean(row.notes) && (entryObject.nt = row.notes);

  // selectively process associated images and audio ONLY if marked as part of an archive
  // standalone CSV files cannot possibly have properly attached files
  if (partOfArchive) {
    Boolean(row.soundFile) &&
      (entryObject.sf = {
        path: `audio/${getStoragePath(row.soundFile, importId, dictionaryId, timestamp)}`,
        source: `import: ${importId}`,
        ts: timestamp,
        ab: uid,
      });

    // fetch Image serving url
    if (row.photoFile) {
      const imageStoragePath = `images/${getStoragePath(
        row.photoFile,
        importId,
        dictionaryId,
        timestamp
      )}`;
      const environment = 'prod'; // TODO, retrieve env (dev/prod) from: process.env.GCP_PROJECT, but do it higher up the chain such that it's only retrieved once and not for each photo // https://stackoverflow.com/questions/44078037/how-to-get-firebase-project-name-or-id-from-cloud-function
      try {
        const url = await getImageServingUrl(imageStoragePath, environment, uid);
        if (typeof url !== 'string') {
          throw new Error(
            `UID: ${uid} -- URL to serve image is not a valid string, perhaps the image does not exist at this url.`
          );
        }
        entryObject.pf = {
          path: imageStoragePath,
          gcs: url,
          source: `import: ${importId}`,
          ts: timestamp,
          ab: uid,
        };
      } catch (err) {
        throw new Error(`transformJsonRow getImageServingUrl UID: ${uid} -- ${err}`);
      }
    }
  }

  return entryObject;
}

/*
 *  SAMPLE DATA

 {
    "oid": "3856",
    "lang": "(ng??)asemenonggo",
    "ipa": "(ng??)asemenonggo",
    "gloss": "y&#8217;all ask you",
    "pos": "v. paradigm example",
    "usage_example": "",
    "dialect": "",
    "metadata": "Vpara 2244, 16-July-11, Matugar, PNG. Recorded by Danielle Barth.",
    "authority": "Kadagoi Rawad",
    "audio": "Vpara2244_16July2011_Kadagoi_Yall Ask You_a.mp3",
    "image": "",
    "semantic_ids": "",
    "tpi_gloss": "yupela askim yu"
  },

  */

export async function transformTDJsonRow(
  row: any,
  uid: string,
  timestamp: any,
  importId: string,
  dictionaryId: string,
  lineNumber: number,
  partOfArchive?: boolean
) {
  // validate for required elements
  if (!row.lang) throw new Error(`No lexeme (lang) found for item ${lineNumber + 1}`);
  // build surrogate object
  const entryObject: IEntry = { lx: '', gl: {} };
  // add timestamps and creator metadata
  Boolean(timestamp) && (entryObject.createdAt = timestamp);
  Boolean(uid) && (entryObject.createdBy = uid);
  Boolean(timestamp) && (entryObject.updatedAt = timestamp);
  Boolean(uid) && (entryObject.updatedBy = uid);
  Boolean(importId) && (entryObject.source = `import: ${importId}`);

  // migrate gloss to en_gloss prior to preprocessing all glosses
  Boolean(row.gloss) && (row.en_gloss = row.gloss);

  // preprocess collections from gloss column keys (e.g. es_gloss, tpi_gloss, etc.)
  if (Object.keys(row).join('').includes('gloss')) {
    const gloss: IGloss = extractCollectionValues(row, '_gloss');
    entryObject.gl = gloss;
  }
  // preprocess collections from example sentences
  // if(Boolean(Object.keys(row).join('').includes('exampleSentence')))  {
  //     const example: IExampleSentence = extractCollectionValues(row, 'exampleSentence_');
  //     entryObject.xs = example;
  // }
  // preprocess collections in single column inputs (pipe separated standard)
  // Boolean(row.semantic_ids)       && (() => { entryObject.sd = processMultiItemString(row.semantic_ids) })()
  Boolean(row.semantic_ids) && (entryObject.sd = row.semantic_ids);
  Boolean(row.lang) && (entryObject.lx = row.lang);
  Boolean(row.ipa) && (entryObject.ph = row.ipa);
  Boolean(row.morphology) && (entryObject.mr = row.morphology);
  Boolean(row.interlinearization) && (entryObject.in = row.interlinearization);
  Boolean(row.pos) && (entryObject.ps = row.pos);
  Boolean(row.dialect) && (entryObject.di = row.dialect);
  Boolean(row.metadata) && (entryObject.nt = row.metadata);
  Boolean(row.usage_example) && (entryObject.xv = row.usage_example); // example vernacular

  // selectively process associated images and audio ONLY if marked as part of an archive
  // standalone CSV files cannot possibly have properly attached files
  if (partOfArchive) {
    Boolean(row.audio) &&
      (entryObject.sf = {
        path: `audio/${getStoragePath(row.audio, importId, dictionaryId, timestamp)}`,
        source: `import: ${importId}`,
        previousFileName: row.audio,
      });
    Boolean(row.authority) && (entryObject.sf.speakerName = row.authority);

    // fetch Image serving url
    if (row.photoFile) {
      const imageStoragePath = `images/${getStoragePath(
        row.photoFile,
        importId,
        dictionaryId,
        timestamp
      )}`;
      const environment = 'prod'; // TODO, retrieve env (dev/prod) from: process.env.GCP_PROJECT, but do it higher up the chain such that it's only retrieved once and not for each photo // https://stackoverflow.com/questions/44078037/how-to-get-firebase-project-name-or-id-from-cloud-function
      try {
        const url = await getImageServingUrl(imageStoragePath, environment, uid);
        if (typeof url !== 'string') {
          throw new Error(
            `UID: ${uid} -- URL to serve image is not a valid string, perhaps the image does not exist at this url.`
          );
        }
        entryObject.pf = {
          path: imageStoragePath,
          gcs: url,
          source: `import: ${importId}`,
          ts: timestamp,
          ab: uid,
        };
      } catch (err) {
        throw new Error(`transformTDJsonRow getImageServingUrl UID: ${uid} -- ${err}`);
      }
    }
  }
  return entryObject;
}

export async function unzipFirebaseArchive(
  bucketInstance: any,
  importFilePath: string,
  uid: string,
  timestamp: any,
  importId: string,
  dictionaryId: string
) {
  // unzip archive first
  const archiveDir = importFilePath.replace('.zip', '');
  let formatIdx = -1;
  // open file reading stream
  await new Promise((resolve, reject) => {
    bucketInstance
      .file(importFilePath)
      .createReadStream()
      .on('error', (err) => {
        reject(`UID: ${uid} -- ${err}`);
      })
      // parse the stream with an unzip
      .pipe(unzip.Parse())
      // with each file parsed, create output path to extract to
      .on('entry', (entry) => {
        const { fileRef, contentType, dictionaryFormatIdx } = getFileMeta(
          bucketInstance,
          entry,
          archiveDir,
          timestamp,
          importId,
          dictionaryId
        );
        if (dictionaryFormatIdx > -1) {
          formatIdx = dictionaryFormatIdx;
        }
        let meta = { metadata: {} };
        if (entry.type === 'File') {
          meta = { metadata: { contentType: contentType } };
        }
        // pipe the entry into an output file
        entry.pipe(fileRef.createWriteStream(meta)).on('error', (err) => {
          reject(`UID: ${uid} -- ${err}`);
        });
      })
      .on('finish', () => {
        resolve();
      });
  });
  console.log(`formatIdx: ${formatIdx}`);
  return formatIdx;
}

export async function validateCSV(
  uid: string,
  dictionaryPath: string,
  timestamp: any,
  importId: string,
  dictionaryId: string
) {
  const result = { ERRORS: [] };
  await csv()
    .fromFile(dictionaryPath)
    .subscribe(
      async (json, lineNumber) => {
        if (lineNumber > 0) {
          // skips explanation header row (row 2) in CSV template
          try {
            await transformJsonRow(json, uid, timestamp, importId, dictionaryId, lineNumber);
          } catch (err) {
            result.ERRORS.push(err);
          }
        }
      },
      (err) => {
        result.ERRORS.push(err);
      }
    );
  return result;
}

export async function processCSV(
  db: any,
  uid: string,
  dictionaryPath: string,
  timestamp: any,
  importId: string,
  dictionaryId: string,
  isArchived?: boolean
) {
  const result = { ERRORS: [], importCount: 0 };
  let batch = db.batch();
  const colRef = db.collection(`dictionaries/${dictionaryId}/words`);
  let stopcount = -1;
  const batchSize = 299;
  await csv()
    .fromFile(dictionaryPath)
    .subscribe(
      async (json, lineNumber) => {
        if (lineNumber > 0) {
          // skips explanation header row (row 2) in CSV template
          try {
            const entryId = colRef.doc().id;
            const docRef = colRef.doc(entryId);
            const row = await transformJsonRow(
              json,
              uid,
              timestamp,
              importId,
              dictionaryId,
              lineNumber,
              isArchived
            );
            batch.set(docRef, row);
            if (stopcount === batchSize) {
              await batch.commit();
              batch = db.batch();
              stopcount = -1;
            }
            stopcount = stopcount + 1;
            ++result.importCount;
          } catch (err) {
            result.ERRORS.push(err);
          }
        }
      },
      (err) => {
        result.ERRORS.push(err);
      }
    );
  await batch.commit();
  return result;
}

export async function importXLS(dictionaryPath: string) {
  const workbook = xlsx.readFile(dictionaryPath);
  const sheet_name_list = workbook.SheetNames;
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
}
