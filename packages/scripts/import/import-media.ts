import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

import * as fs from 'fs';
import { IPhoto } from '@living-dictionaries/types';
import { environment, storage, timestamp } from '../config.js';
import { getImageServingUrl } from './getImageServingUrl.js';
import { ActualDatabasePhoto } from '@living-dictionaries/types/photo.interface.js';

const fileBucket = `talking-dictionaries-${environment == 'prod' ? 'alpha' : 'dev'}.appspot.com`;

export async function uploadAudioFile(
  audioFileName: string,
  entryId: string,
  dictionaryId: string,
  dry = false
): Promise<string> {
  const audioDir = join(__dirname, `data/${dictionaryId}/audio`);
  const audioFilePath = join(audioDir, audioFileName);

  if (!fs.existsSync(audioFilePath)) {
    console.log(`>> Missing audio file: ${audioFileName}`);
    return null;
  }

  try {
    const fileTypeSuffix = audioFileName.match(/\.[0-9a-z]+$/i)[0];
    const uploadedAudioPath = `${dictionaryId}/audio/${entryId}_${new Date().getTime()}${fileTypeSuffix}`;

    if (!dry) {
      await storage.bucket(fileBucket).upload(audioFilePath, {
        destination: uploadedAudioPath,
        metadata: {
          originalFileName: audioFileName,
        },
      });
    }
    return uploadedAudioPath;
  } catch (err) {
    console.log(
      `!!! Not adding audio ${audioFileName} as the server had trouble uploading it. Double-check the file to see if there is a problem with it or perhaps there is code/server/network-connection problem. Error: ${err}`
    );
    return null;
  }
}

export async function uploadImageFile(
  imageFileName: string,
  entryId: string,
  dictionaryId: string,
  dry = false
): Promise<ActualDatabasePhoto> {
  const imageDir = join(__dirname, `data/${dictionaryId}/images`);
  const imageFilePath = join(imageDir, imageFileName);

  if (!fs.existsSync(imageFilePath)) {
    console.log(`>> Missing image file: ${imageFileName}`);
    return null;
  }

  try {
    const fileTypeSuffix = imageFileName.match(/\.[0-9a-z]+$/i)[0];
    const storagePath = `${dictionaryId}/images/${entryId}_${new Date().getTime()}${fileTypeSuffix}`;
    if (dry) {
      return { path: storagePath, gcs: 'no-path-bc-dry-run' };
    }

    await storage.bucket(fileBucket).upload(imageFilePath, {
      destination: storagePath,
      metadata: {
        originalFileName: imageFileName,
      },
    });

    const gcsPath = await getImageServingUrl(storagePath, environment);
    return {
      path: storagePath,
      gcs: gcsPath,
      ts: timestamp,
      // cr: // not yet included in import template
    };
  } catch (err) {
    console.log(
      `!!! Not adding image ${imageFileName} as the server had trouble digesting it. Double-check the file to see if it is just a corrupted jpg (as some are) or if the file is good and perhaps there is code/server/network-connection problem. Error: ${err}`
    );
    return null;
  }
}
