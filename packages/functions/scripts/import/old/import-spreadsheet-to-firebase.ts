import { db, timestamp, storage } from '../config';
import * as fs from 'fs-extra';

// import { IEntry } from '../../../svelte/src/interfaces/entry.interface';
import { getImageServingUrl } from '../helpers/getImageServingUrl';

export const importSpreadsheetToFirebase = async (
  data: any[],
  dictionaryId: string,
  environment: string,
  dateStamp: number,
  dryRun: boolean
) => {
  try {
    let audioRefCount = 0;
    let audioMissingCount = 0;
    let imageRefCount = 0;
    let imageMissingCount = 0;

    let entryCount = 0;
    let batchCount = 0;
    let batch = db.batch();
    const colRef = db.collection(`dictionaries/${dictionaryId}/words`);

    for (const row of data) {
      // learned from https://lavrton.com/javascript-loops-how-to-handle-async-await-6252dd3c795/
      // if (entryCount == 10) { break } // to incrementally test larger and larger imports
      if (!row.lexeme || row.lexeme === '(word/phrase)') {
        continue;
      }

      ++entryCount;
      // console.log(entryCount, row);
      // TODO: restore IEntry type
      const entry: any = { lx: '', gl: {} };

      entry.lx = row.lexeme;
      Boolean(row.phonetic) && (entry.ph = row.phonetic);
      Boolean(row.morphology) && (entry.mr = row.morphology);
      Boolean(row.interlinearization) && (entry.in = row.interlinearization);
      Boolean(row.partOfSpeech) && (entry.ps = row.partOfSpeech);
      Boolean(row.dialect) && (entry.di = row.dialect);
      if (row.semanticDomain) {
        entry.sdn = [row.semanticDomain.toString()];
        Boolean(row.semanticDomain2) && entry.sdn.push(row.semanticDomain2.toString());
      }
      Boolean(row.semanticDomain_custom) && (entry.sd = row.semanticDomain_custom);
      Boolean(row.notes) && (entry.nt = row.notes);
      Boolean(row.ID) && (entry.ei = row.ID);

      Object.keys(row).forEach((key) => {
        // gloss fields are labeled using bcp47 language codes followed by '_gloss' (e.g. es_gloss, tpi_gloss)
        if (key.includes('_gloss') && row[key]) {
          const language = key.split('_gloss')[0];
          {
            entry.gl[language] = row[key];
          }
        }
      });

      Boolean(row.localOrthography) && (entry.lo = row.localOrthography);
      Boolean(row.localOrthography2) && (entry.lo2 = row.localOrthography2);
      Boolean(row.localOrthography3) && (entry.lo3 = row.localOrthography3);

      // if example sentences, check for any, set up the entry.xs object add as appropriate
      // vn = vernacular, everything else is by bcp code
      // if (row.vernacular_exampleSentence or any other exampleSentenc field) {
      //     entry.xs = {};
      //     Boolean(row.vernacular_exampleSentence) && (entry.xs['vn'] = row.vernacular_exampleSentence);
      // }

      if (row.soundFile) {
        ++audioRefCount;
        const localFilePath = `dictionary/${dictionaryId}/audio/${row.soundFile}`;
        if (fs.existsSync(localFilePath)) {
          const storagePath = appendDateBeforeExtension(
            `${dictionaryId}/audio/local_import/${sanitizeFileName(row.soundFile)}`
          );
          if (!dryRun) {
            await storage.bucket().upload(localFilePath, {
              destination: storagePath,
              metadata: { fileName: row.soundFile },
            });
          }
          entry.sf = {
            path: storagePath,
            sc: `local_import`,
          };
          Boolean(row.speakerName) && (entry.sf.speakerName = row.speakerName);
        } else {
          ++audioMissingCount;
          console.log(`>> Missing audio file for ${entry.lx}| ${row.soundFile}`);
        }
      }

      if (row.photoFile) {
        ++imageRefCount;
        const localFilePath = `dictionary/${dictionaryId}/images/${row.photoFile}`;
        if (fs.existsSync(localFilePath)) {
          const storagePath = appendDateBeforeExtension(
            `${dictionaryId}/images/local_import/${sanitizeFileName(row.photoFile)}`
          );
          if (!dryRun) {
            await storage.bucket().upload(localFilePath, {
              destination: storagePath,
              metadata: { fileName: row.photoFile },
            });
            try {
              const url = await getImageServingUrl(storagePath, environment);
              entry.pf = {
                path: storagePath,
                gcs: url,
                sc: `local_import`,
              };
            } catch (err) {
              console.log(
                `!!! Not adding image ${row.photoFile} to ${entry.lx} as the server had trouble digesting it. Double-check the files to see if it is just a corrupted jpg (as some are) or if the file is good (means there is code/server problem).`
              );
            }
          } else {
            console.log('pf: ', storagePath);
          }
        } else {
          ++imageMissingCount;
          console.log(`>> Missing image file for ${entry.lx}| ${row.photoFile}`);
        }
      }

      // add timestamps and creator metadata
      // entry.createdAt = timestamp;
      entry.ii = `v3-${dateStamp}`;
      // entry.updatedAt = timestamp;
      // entry.updatedBy = uid;

      if (!dryRun) {
        if (batchCount === 200) {
          console.log('Committing batch of entries ending with: ', entryCount);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
        batch.create(colRef.doc(), entry);
        batchCount++;
      } else {
        console.log(entry);
      }
    }
    if (!dryRun) {
      await batch.commit();
    }

    console.log(
      `Converted ${entryCount} entries, found ${audioRefCount} audio references (${audioMissingCount} were missing), and ${imageRefCount} image references (${imageMissingCount} were missing)`
    );

    return entryCount;
  } catch (error) {
    console.log('Import to Firebase failed');
    throw new Error(error);
  }
};

/**
 * Santize file name down to basic characters that can be accepted by Google's Serving Url generator
 * Use like this: `${dictionaryId}/audio/import_${importId}/${sanitizeFileName(filePath)}`
 */
const sanitizeFileName = (fileName: string): string => {
  return fileName.replace(/[^a-z0-9_\.+]+/gi, '-');
};

const appendDateBeforeExtension = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex == -1) return fileName + '-' + Date.now();
  else return fileName.substring(0, dotIndex) + '-' + Date.now() + fileName.substring(dotIndex);
};
