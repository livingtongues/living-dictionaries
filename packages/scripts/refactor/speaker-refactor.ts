import { ActualDatabaseEntry, ISpeaker } from '@living-dictionaries/types';
import { db, timestamp } from '../config';
import { program } from 'commander';
program
//   .version('0.0.1')
  .option('--id <value>', 'Dictionary Id')
  .option('--live', 'If not included, only log values')
  .parse(process.argv);

const dictionaryId = program.opts().id;
const {live} = program.opts();

interface unique_speakers {
  id: string;
  name: string;
 }
const all_speakers: unique_speakers[] = [];
const developer_in_charge = 'qkTzJXH24Xfc57cZJRityS6OTn52'; // diego@livingtongues.org -> Diego Córdova Nieto;
let speakers_to_remove: unique_speakers[];
let speakerDuplicationHandled = false;

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
  const speakerCollectionRef = db.collection('speakers');
  const dictionarySpeakerSnapshot = await speakerCollectionRef.where('contributingTo', 'array-contains', dictionaryId).get();
  dictionarySpeakerSnapshot.docs.forEach((snap) => all_speakers.push({ name: snap.data().displayName, id: snap.id }));
  const snapshot = await db.collection(`dictionaries/${dictionaryId}/words`).get();
  for (const snap of snapshot.docs) {
    const entry: ActualDatabaseEntry = { id: snap.id, ...(snap.data() as ActualDatabaseEntry) };
    await addSpeakerIdToEntry(dictionaryId, entry, [{gender: 'f', displayName: 'Dano'}, {gender: 'm', displayName: 'Ilo'}, {birthplace: 'Mexico', displayName: 'Cañitas'}]); // * Modify this line with real speaker Data
    // await avoidSpeakerDuplication(dictionaryId, entry, '9BtMqTEXpfWfUZ6jCXHG');
  }
  if (speakerDuplicationHandled)
    deleteDuplicateSpeakers();
}

const addSpeaker = async (speakerData: ISpeaker) => {
  const speaker = db.collection('speakers').doc();
  console.log(`Saving speaker... speaker id: ${speaker.id}`)
  if (!live) return speaker.id;
  await speaker.set(speakerData);
  return speaker.id;
}

const createEntrySoundFiles = (entry: ActualDatabaseEntry, speakerId: string, path: string) => {
  entry.sfs = [{
    ab: developer_in_charge,
    sp: [speakerId],
    path,
    ts: new Date().getTime()
  }]
}

const addSpeakerIdToEntry = async (dictionaryId: string, entry: ActualDatabaseEntry, speakersData: ISpeaker[]) => {
  const sfBefore = entry.sf;
  if (entry.sf?.speakerName) {
    let speakerId = all_speakers.find(speaker => speaker.name === entry.sf.speakerName)?.id;
    if (!speakerId && speakersData.some(speaker => speaker.displayName === entry.sf.speakerName)) {
      const specificSpeaker = speakersData.find(speaker => speaker.displayName === entry.sf.speakerName)
      speakerId = await addSpeaker({
        ...specificSpeaker,
        displayName: entry.sf.speakerName,
        contributingTo: [dictionaryId],
        createdAt: timestamp,
        createdBy: developer_in_charge,
        updatedAt: timestamp,
        updatedBy: developer_in_charge
      });
      all_speakers.push({ name: entry.sf.speakerName, id: speakerId });
    }

    console.log(entry.id);
    console.log(`Before: sf-${JSON.stringify(sfBefore)} sfs-${JSON.stringify(entry?.sfs)}`);
    createEntrySoundFiles(entry, speakerId, entry.sf.path);
    delete entry.sf;
    console.log(`After: sf-${JSON.stringify(entry?.sf)} sfs-${JSON.stringify(entry.sfs)}`);
  }
  if (!live) return;
  await db.collection(`dictionaries/${dictionaryId}/words`).doc(entry.id).set(entry);
}

const avoidSpeakerDuplication = async (dictionaryId: string, entry:ActualDatabaseEntry, speakerId: string) => {
  if (entry.sfs) {
    const selected_speaker = all_speakers.find(speaker => speaker.id === speakerId);

    if (!speakers_to_remove)
      speakers_to_remove = all_speakers.filter(speaker => (speaker.name === selected_speaker.name && speaker.id != selected_speaker.id));

    if (speakers_to_remove.length > 0) {
      if (speakers_to_remove.some(speaker => speaker.id === entry.sfs[0].sp[0])) {
        console.log(entry.id);
        console.log(`before sfs-${JSON.stringify(entry?.sfs)}`);
        entry.sfs[0].sp = [selected_speaker.id]
        console.log(`after sfs-${JSON.stringify(entry?.sfs)}`);
      }
    }
    speakerDuplicationHandled = true;
    if (!live) return;
    await db.collection(`dictionaries/${dictionaryId}/words`).doc(entry.id).set(entry);
  }
}

const deleteDuplicateSpeakers = async () => {
  if (speakers_to_remove.length > 0) {
    for (const speaker of speakers_to_remove)
      console.log(`deleting ${JSON.stringify(speaker)}`)
    if (!live) return;
    for (const speaker of speakers_to_remove)
      await db.doc(`speakers/${speaker.id}`).delete();
  }
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
