import { db, timestamp, storage } from '../../config';
import * as fs from 'fs';

import { abbreviateTDPartOfSpeech } from '../../../src/import/helpers/abbreviate-td-pos';
// import { IEntry } from '../../../svelte/src/interfaces/entry.interface';
import { getImageServingUrl } from '../../../src/import/helpers/getImageServingUrl';
const uid = 'OTD'; // 'Old Talking Dictionaries

export const importToFirebase = async (
  data: any[],
  dictionaryId: string,
  environment: string,
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
      // if (entryCount == 50) { break } // to incrementally test larger and larger imports
      ++entryCount;

      // console.log(row);
      const entry: any = { lx: '', gl: {} };

      // Always set lexeme even if blank string
      entry.lx = row.lang;

      if (row.gloss) {
        entry.gl['en'] = row.gloss;
      }
      Object.keys(row).forEach((key) => {
        // Except for English, gloss fields are labeled using bcp47 language codes followed by '_gloss' (e.g. es_gloss, tpi_gloss)
        if (key.includes('_gloss') && row[key]) {
          const language = key.split('_gloss')[0];
          {
            entry.gl[language] = row[key];
          }
        }
      });

      if (row.usage_example) {
        entry.xs = {};
        entry.xs['vernacular'] = row.usage_example;
      }

      Boolean(row.semantic_ids) && (entry.sd = [row.semantic_ids]);
      Boolean(row.ipa) && (entry.ph = row.ipa.replace(/[[\]]/g, '')); // Strip surrounding brackets if they are present in phonetic value);
      Boolean(row.dialect) && (entry.di = row.dialect);

      if (row.pos) {
        const { matchedPOS, unMatchedPOS, notes } = abbreviateTDPartOfSpeech(row.pos);
        if (matchedPOS) {
          entry.ps = matchedPOS;
        } else {
          entry.ps = unMatchedPOS; // Still saving unmatched POS into same cell
        }
        if (notes) {
          entry.nt = notes; // save parenthetical notes
        }
      }

      if (row.metadata) {
        if (entry.nt) {
          entry.nt = entry.nt + ', ' + row.metadata;
        } else {
          entry.nt = row.metadata;
        }
      }

      if (row.audio) {
        ++audioRefCount;
        const localFilePath = `dictionary/${dictionaryId}/audio/${row.audio}`;
        if (fs.existsSync(localFilePath)) {
          const storagePath = appendDateBeforeExtension(
            `${dictionaryId}/audio/local_import/${sanitizeFileName(row.audio)}`
          );
          if (!dryRun) {
            await storage.bucket().upload(localFilePath, {
              destination: storagePath,
            });
          }
          entry.sf = {
            path: storagePath,
            source: `local_import`,
            ts: timestamp,
          };
          Boolean(row.authority) && (entry.sf.speakerName = row.authority);
        } else {
          ++audioMissingCount;
          console.log(`>> Missing audio file for ${entry.lx}| ${row.audio}`);
        }
      }

      if (row.image) {
        ++imageRefCount;
        const beginsWithDotUnderscore = /^\._/; // several images in Gta begin with ._ (all corrupted) but have actual images under same name without prefix
        if (beginsWithDotUnderscore.test(row.image)) {
          row.image = row.image.replace(beginsWithDotUnderscore, '');
        }
        const localFilePath = `dictionary/${dictionaryId}/images/${row.image}`;
        if (fs.existsSync(localFilePath)) {
          const storagePath = appendDateBeforeExtension(
            `${dictionaryId}/images/local_import/${sanitizeFileName(row.image)}`
          );
          if (!dryRun) {
            await storage.bucket().upload(localFilePath, {
              destination: storagePath,
            });
            try {
              const url = await getImageServingUrl(storagePath, environment);
              entry.pf = {
                path: storagePath,
                gcs: url,
                source: `local_import`,
              };
            } catch (err) {
              console.log(
                `!!! Not adding image ${row.image} to ${entry.lx} as the server had trouble digesting it. Double-check the files to see if it is just a corrupted jpg (as some are) or if the file is good (means there is code/server problem).`
              );
            }
          }
        } else {
          ++imageMissingCount;
          console.log(`>> Missing image file for ${entry.lx}| ${row.image}`);
        }
      }

      // add timestamps and creator metadata
      // entry.createdAt = timestamp;
      entry.cb = uid;
      // entry.updatedAt = timestamp;
      // entry.updatedBy = uid;

      // console.log(entry);
      if (!dryRun) {
        if (batchCount === 200) {
          console.log('Committing batch of entries ending with: ', entryCount);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
        batch.create(colRef.doc(), entry);
        batchCount++;
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
  return fileName.replace(/[^a-z0-9.+]+/gi, '-');
};

const appendDateBeforeExtension = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex == -1) return fileName + '-' + Date.now();
  else return fileName.substring(0, dotIndex) + '-' + Date.now() + fileName.substring(dotIndex);
};
