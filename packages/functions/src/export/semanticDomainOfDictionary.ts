// Example Usage:
// http://localhost:5001/talking-dictionaries-dev/us-central1/exportSemanticDomainOfDictionary?dictionaryID=gutob&semanticDomainID=1.3

// https://us-central1-talking-dictionaries-dev.cloudfunctions.net/exportSemanticDomainOfDictionary?dictionaryID=achi-1579819002171&semanticDomainID=1.1
// https://us-central1-talking-dictionaries-alpha.cloudfunctions.net/exportSemanticDomainOfDictionary?dictionaryID=kera-mundari&semanticDomainID=2

import * as functions from 'firebase-functions';

import * as admin from 'firebase-admin';
admin.initializeApp();
const projectId = functions.config().project?.key;

import { IDictionary, IEntry } from '@living-dictionaries/types';
import { entryInterface } from './interfaceExplanations';
import { partsOfSpeech, semanticDomains } from '@ld/parts';

export default async (
  request: functions.https.Request,
  response: functions.Response
): Promise<void> => {
  console.log('Export Semantic Domains Request Query params: ', request.query);
  const queryParams = request.query;
  if (queryParams?.dictionaryID && queryParams?.semanticDomainID) {
    const dictionaryID = queryParams.dictionaryID;
    const semanticDomainID = queryParams.semanticDomainID;

    const dictionarySnap = await admin.firestore().doc(`dictionaries/${dictionaryID}`).get();
    const dictionaryDoc = dictionarySnap.data() as IDictionary;

    if (dictionaryDoc && semanticDomainID === '1.7') {
      const entriesSnapshot = await admin
        .firestore()
        .collection(`dictionaries/${dictionaryID}/words`)
        .where('sdn', 'array-contains', semanticDomainID)
        .get();
      const storageBucket = `talking-dictionaries-${
        projectId === 'talking-dictionaries-alpha' ? 'alpha' : 'dev'
      }.appspot.com`;

      const entries = entriesSnapshot.docs.map((snap) => {
        const entry = snap.data() as IEntry;
        delete entry.ii;
        delete entry.cb;
        // @ts-ignore
        delete entry.createdBy;
        delete entry.ub;
        // @ts-ignore
        delete entry.updatedBy;
        // @ts-ignore
        entry.sourceURL = `https://livingdictionaries.app/${dictionaryID}/entry/${snap.id}`;

        if (entry.sf && entry.sf.path) {
          delete entry.sf.source;
          const convertedPath = entry.sf.path.replace(/\//g, '%2F');
          // @ts-ignore;
          entry.sf.audioURL = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${convertedPath}?alt=media`;
          delete entry.sf.path;
        }

        if (entry.pf && entry.pf.path) {
          delete entry.pf.gcs;
          const convertedPath = entry.pf.path.replace(/\//g, '%2F');
          // @ts-ignore;
          entry.pf.imageURL = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${convertedPath}?alt=media`;
          delete entry.pf.path;
        }

        return {
          ...removeEmpty(entry),
          ...{ id: snap.id },
        };
      });

      delete dictionaryDoc.updatedAt;
      delete dictionaryDoc.updatedBy;
      delete dictionaryDoc.createdAt;
      delete dictionaryDoc.createdBy;

      const data = {
        dataRetrieval: {
          semanticDomain: semanticDomain(semanticDomainID as string),
          semanticDomainID,
          timestamp: new Date(Date.now()),
          query: request.url,
          URL:
            `https://us-central1-talking-dictionaries-${
              projectId === 'talking-dictionaries-alpha' ? 'alpha' : 'dev'
            }.cloudfunctions.net/exportSemanticDomainOfDictionary` + request.url,
        },
        dictionary: {
          dictionaryID,
          URL: `https://livingdictionaries.app/${dictionaryID}`,
          creditURL: `https://livingdictionaries.app/${dictionaryID}/contributors`,
          ...dictionaryDoc,
        },
        entryCount: entriesSnapshot.size,
        entries,
        entryInterface,
        partOfSpeechMappings: partsOfSpeech,
        semanticDomainNumberMappings: semanticDomains,
      };
      response.send(data);
    } else {
      response.send('Invalid dictionary or semantic domain. Please contact us for help if needed.');
    }
  } else {
    response.send('Invalid request - please contact us to help you form a valid request.');
  }
};

function removeEmpty(obj: any) {
  Object.keys(obj).forEach(
    (k) =>
      (obj[k] && typeof obj[k] === 'object' && removeEmpty(obj[k])) ||
      (!obj[k] && obj[k] !== undefined && delete obj[k])
  );
  return obj;
}

function semanticDomain(input: string): string {
  const matching = semanticDomains.find((domain) => {
    return domain.key === input;
  });
  return (matching && matching.name) || 'NOT FOUND';
}
