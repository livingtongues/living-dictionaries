import { IEntry } from '@living-dictionaries/types';
import type admin from 'firebase-admin';

export async function prepareDataForIndex(dbEntry: IEntry, dictionaryId: string, db: admin.firestore.Firestore) {
  const entry: IEntry = dbEntry;
  delete entry.id;
  entry.dictId = dictionaryId;

  if (entry.pf && entry.pf.gcs) {
    entry.hasImage = true;
    entry.pf = {
      gcs: entry.pf.gcs,
    };
  } else {
    entry.hasImage = false;
    delete entry.pf;
  }

  if (entry.sf && entry.sf.path) {
    entry.hasAudio = true;
    const cleanSf: any = {
      path: entry.sf.path,
    };
    if (entry.sf.speakerName) {
      entry.hasSpeaker = true;
      cleanSf.speakerName = entry.sf.speakerName;
    } else if (entry.sf.sp) {
      entry.hasSpeaker = true;
      const speakerSnap = await db.doc(`speakers/${entry.sf.sp}`).get();
      const speaker = speakerSnap.data();
      if (speaker && speaker.displayName) {
        cleanSf.speakerName = speaker.displayName;
      } else {
        const userSnap = await db.doc(`users/${entry.sf.sp}`).get();
        const user = userSnap.data();
        if (user && user.displayName) {
          cleanSf.speakerName = user.displayName;
        }
      }
    } else {
      entry.hasSpeaker = false;
    }
    entry.sf = cleanSf;
  } else {
    entry.hasAudio = false;
    delete entry.sf;
  }

  if (entry.sd || (entry.sdn && entry.sdn.length)) {
    entry.hasSemanticDomain = true;
  } else {
    entry.hasSemanticDomain = false;
  }

  if (entry.ps) {
    entry.hasPartOfSpeech = true;
  } else {
    entry.hasPartOfSpeech = false;
  }

  if (entry.createdBy) {
    entry.cb = entry.createdBy;
    delete entry.createdBy;
  }

  if (entry.updatedBy) {
    entry.ub = entry.updatedBy;
    delete entry.updatedBy;
  }

  if (entry.ua) {
    // @ts-ignore
    entry.ua = entry.ua._seconds;
  }

  if (entry.ca) {
    // @ts-ignore
    entry.ca = entry.ca._seconds;
  }

  if (entry.updatedAt) {
    // @ts-ignore
    entry.ua = entry.updatedAt._seconds;
    delete entry.updatedAt;
  }

  if (entry.createdAt) {
    // @ts-ignore
    entry.ca = entry.createdAt._seconds;
    delete entry.createdAt;
  }

  Object.keys(entry).forEach((key) => {
    //@ts-ignore
    const value = entry[key];
    if (value === '' || value === null) {
      //@ts-ignore
      delete entry[key];
    }
  });

  // Handle ii? (import ID)

  return entry;
}
