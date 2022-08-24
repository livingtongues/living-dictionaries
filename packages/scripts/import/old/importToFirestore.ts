#!/usr/bin/env node

import * as args from 'commander';
import * as admin from 'firebase-admin';
import * as fs from 'fs-extra';
import { join } from 'path';
import { getImageServingUrl } from './getImageServingUrl';
import { abbreviatePOS } from './abbreviatePOS';
import { storage } from './config';

args
  .version('0.0.1')
  .option('-d, --data <file path>', 'Data file path')
  .option('-a, --audio <folder path>', 'Audio folder path')
  .option('-p, --photos [folder path]', 'Photos folder path') //optional argument indicated by square brackets, skip image import if not specified
  // .option("-c, --collection <path>", "Collection path in firestore")
  .option('-i, --dictionaryId <dictionaryId>', 'Dictionary Id in firestore')
  .option('-n, --dictionaryName <dictionaryName>', 'Dictionary name, used in saving media files')
  .option('-e, --environment [dev/prod]', 'Firebase Project') //optional argument, script uses dev if not specified
  .parse(process.argv);

const devServiceAccount = require('../service-accounts/talking-dictionaries-dev.json');
const prodServiceAccount = require('../service-accounts/talking-dictionaries-alpha.json');

admin.initializeApp({
  credential: admin.credential.cert(
    args.environment == 'prod' ? prodServiceAccount : devServiceAccount
  ),
  databaseURL: `https://talking-dictionaries-${
    args.environment == 'prod' ? 'alpha' : 'dev'
  }.firebaseio.com`,
});
const db = admin.firestore();

const fileBucket = `talking-dictionaries-${
  args.environment == 'prod' ? 'alpha' : 'dev'
}.appspot.com`;

async function importToFirestore() {
  try {
    const colPath = `dictionaries/${args.dictionaryId}/words`;
    const file = args.data;

    const colRef = db.collection(colPath);
    const batch = db.batch();

    let data;
    if (file.includes('.json')) {
      data = await fs.readJSON(file);
    }

    // TODO get script to loop through sets of 500 automatically once it matures
    // Firestore 'cannot write more than 500 entities in a single call' so we have to upload in chunks
    // See https://github.com/firebase/firebase-admin-java/issues/106 for a possible automated chunking solution
    const commitRound = 0; // start at 0
    const batchStart = 0 + 500 * commitRound;
    const batchEnd = 499 + 500 * commitRound;

    for (let i = 0; i < data.length; i++) {
      if (i < batchStart || i > batchEnd) {
        continue;
      }

      const entry = data[i];
      entry.lx = entry.lang || '';
      delete entry.lang;
      entry.ph = entry.ipa || '';
      delete entry.ipa;

      entry.ps = abbreviatePOS(entry.pos || '');
      delete entry.pos;

      entry.di = entry.dialect || '';
      delete entry.dialect;

      entry.xv = entry.usage_example || '';
      delete entry.usage_example;

      entry.lc = entry.metadata || ''; // location
      delete entry.metadata;

      // learn about try/catch so I can convert this to const uploadedAudioPath = await upload...()
      // maybe the outer parent catch will even catch this? Test it out.

      const entryId = colRef.doc().id;

      await uploadAudioFile(entry.audio, entry.lx, entryId)
        .then((response: any) => {
          const dateArray = entry.audio.match(/([0-9]*)_([0-9]*)_([0-9]*)/);
          entry.sf = {
            cr: entry.authority || '', // speaker
            ts: dateArray ? new Date(`${dateArray[1]}, ${dateArray[2]}, ${dateArray[3]}`) : null,
            path: response.uploadedAudioPath,
          };
          delete entry.audio;
        })
        .catch((err) => console.log(err));

      if (args.photos) {
        await uploadImageFile(entry, entryId)
          .then((response) => {
            entry.pf = response;
            delete entry.image;
          })
          .catch((err) => console.log(err));
      } else {
        entry.pf = null;
        delete entry.image;
      }

      delete entry.authority;

      entry.sd = entry.semantic_ids || '';
      delete entry.semantic_ids;

      entry.gl = {
        English: entry.gloss || '',
        Español: entry.es_gloss || '',
      };
      delete entry.gloss;
      delete entry.es_gloss;

      const docRef = colRef.doc(entryId);
      batch.set(docRef, entry);
      console.log(`Added ${i} to batch: ${entry.lx}`);
    }

    await batch.commit();
    console.log('Firestore import completed successfully.');
  } catch (error) {
    console.log('Migration failed!', error);
  }
}

const uploadAudioFile = (audioFileName, lexeme, entryId) => {
  return new Promise((resolve, reject) => {
    if (!audioFileName) {
      reject(`No audio found for ${lexeme}`);
    }

    const audioDir = join(__dirname, `../${args.audio}`);
    const audioFilePath = join(audioDir, audioFileName);

    const uploadedAudioName = lexeme.replace(/ /g, '_').replace(/\./g, '');
    const audioType = audioFileName.match(/\.[0-9a-z]+$/i);

    const uploadedAudioPath = `audio/${args.dictionaryName}_${args.dictionaryId}/${uploadedAudioName}_${entryId}${audioType}`;

    storage
      .bucket(fileBucket)
      .upload(audioFilePath, {
        destination: uploadedAudioPath,
      })
      .then(() => {
        resolve({ uploadedAudioPath });
      })
      .catch((err) => {
        reject(err);
      });
  });
};

const uploadImageFile = async (entry, entryId) => {
  // eslint-disable-next-line no-useless-catch
  try {
    const pictureFileName = entry.image;
    const lexeme = entry.lx;
    if (!pictureFileName) {
      throw `No image found for ${lexeme}`;
    }

    const imageDir = join(__dirname, `../${args.photos}`);
    const imageFilePath = join(imageDir, pictureFileName);

    const uploadedImageName = lexeme.replace(/ /g, '_').replace(/\./g, '');
    const imageType = pictureFileName.match(/\.[0-9a-z]+$/i);

    const uploadedImagePath = `images/${args.dictionaryName}_${args.dictionaryId}/${uploadedImageName}_${entryId}${imageType}`;

    await storage.bucket(fileBucket).upload(imageFilePath, {
      destination: uploadedImagePath,
    });

    const gcsPath = await getImageServingUrl(uploadedImagePath, args.environment);
    const dateArray = pictureFileName.match(/([0-9]*)_([0-9]*)_([0-9]*)/);
    const pf = {
      cr: entry.authority || '', // speaker
      ts: dateArray ? new Date(`${dateArray[1]}, ${dateArray[2]}, ${dateArray[3]}`) : null,
      path: uploadedImagePath,
      gcs: gcsPath, // Google Cloud Storage Link
    };

    return pf;
  } catch (err) {
    throw err;
  }
};

importToFirestore();
