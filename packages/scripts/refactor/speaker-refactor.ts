import { ActualDatabaseEntry, ISpeaker } from '@living-dictionaries/types';
import { db, timestamp } from '../config';
import { program } from 'commander';
// import { CollectionReference } from 'firebase/firestore';
program
//   .version('0.0.1')
  .option('--id <value>', 'Dictionary Id')
  .option('--live', 'If not included, only log values')
  .parse(process.argv);

const dictionaryId = program.opts().id;
const {live} = program.opts();

type unique_speakers = Record<string, string>;
const different_speakers: unique_speakers[] = [];
const developer_in_charge = 'qkTzJXH24Xfc57cZJRityS6OTn52'; // diego@livingtongues.org -> Diego Córdova Nieto;

async function speakerRefactor() {
  try {
    if (dictionaryId) {
      console.log(`---Refactoring: ${dictionaryId}`);
      await fetchEntries(dictionaryId);
    } else {
      const snapshot = await db.collection('dictionaries').get();
      for (const dictionarySnap of snapshot.docs) {
        // If setting limits on refactoring, you can skip dictionaries beginning with letters that have already been processed:
        const done = /^[abcdefghijklmn].*/;
        if (!done.test(dictionarySnap.id.toLowerCase())) {
          console.log(`---Refactoring: ${dictionarySnap.id}`);
          await fetchEntries(dictionarySnap.id);
        }
      }
    }
  } catch (error) {
    console.error('Refactor failed!');
    console.error(error);
  }
}

async function fetchEntries(dictionaryId: string) {
  const speakerRef = db.collection('speakers');
  const dictionarySpeakerSnapshot = await speakerRef.where('contributingTo', 'array-contains', dictionaryId).get();
  dictionarySpeakerSnapshot.docs.forEach((snap) => different_speakers.push({ [snap.data().displayName]: snap.id }));
  const snapshot = await db.collection(`dictionaries/${dictionaryId}/words`).get();
  for (const snap of snapshot.docs) {
    const entry: ActualDatabaseEntry = { id: snap.id, ...(snap.data() as ActualDatabaseEntry) };
    await addSpeakerIdToEntry(dictionaryId, entry, {birthplace: 'USA', displayName: ''}, speakerRef); // Modify this line with real speaker Data
  }
}

const addSpeaker = async (speakerData: ISpeaker, speakerRef: any) => {

  const speakerId = speakerRef.doc().id;
  console.log(`Saving speaker... speaker id: ${speakerId}`)
  if (!live) return speakerId
  await speakerRef.doc(speakerId).set(speakerData);
  return speakerId;
}

const addSpeakerIdToEntry = async (dictionaryId: string, entry: ActualDatabaseEntry, speakerData: ISpeaker, speakerRef: any) => {
  // let speakerId = null;
  const sfBefore = entry.sf;
  if (entry.sf?.speakerName) {
    let speakerId = different_speakers.find(speaker => Object.keys(speaker).some(key => key === entry.sf.speakerName))?.[entry.sf.speakerName];
    if (!speakerId) {
      speakerId = await addSpeaker({
        ...speakerData,
        displayName: entry.sf.speakerName,
        contributingTo: [dictionaryId]
      }, speakerRef);
      different_speakers.push({ [entry.sf.speakerName]: speakerId });
    }

    console.log(`Before: sf-${JSON.stringify(sfBefore)} sfs-${JSON.stringify(entry?.sfs)}`);
    entry.sfs = [{
      ab: developer_in_charge,
      sp: [speakerId],
      path: entry.sf.path,
      ts: timestamp
    }]
    delete entry.sf;
    console.log(`After: sf-${JSON.stringify(entry?.sf)} sfs-${JSON.stringify(entry.sfs)}`);
  }
  if (!live) return;
  await db.collection(`dictionaries/${dictionaryId}/words`).doc(entry.id).set(entry);
}

speakerRefactor();

// Single Dictionary
// `pnpm entryRefactor --id babanki` to log refactor in dev
// `pnpm entryRefactor --id babanki --live` to do refactor in dev
// `pnpm entryRefactor --id babanki -e prod` to log refactor in prod
// `pnpm entryRefactor --id babanki --live -e prod` to do refactor in prod

// All dictionaries
// `pnpm entryRefactor` to log refactor in dev
// `pnpm entryRefactor --live` to do refactor in dev
// `pnpm entryRefactor -e prod` to log refactor in prod
// `pnpm entryRefactor --live -e prod` to do refactor in prod
