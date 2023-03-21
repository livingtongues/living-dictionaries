import { ActualDatabaseEntry, AlgoliaEntry } from '@living-dictionaries/types';
import { ActualDatabaseAudio } from '@living-dictionaries/types/audio.interface';
import type { firestore } from 'firebase-admin';

export async function prepareDataForIndex(
  dbEntry: ActualDatabaseEntry,
  dictionaryId: string,
  db: firestore.Firestore
): Promise<AlgoliaEntry> {
  // TODO: remove spread of first_sense once refactoring into first sense is complete
  const first_sense = dbEntry.sn?.[0];
  // TODO: remove need to backport sfs to sf once refactoring is complete
  const first_sound_file = await get_first_sound_file(dbEntry, db);
  const algolia_entry: AlgoliaEntry = {
    ...dbEntry as Omit<ActualDatabaseEntry, 'ua' | 'ca'>,
    gl: first_sense?.gl || dbEntry.gl,
    ps: first_sense?.ps || dbEntry.ps,
    sd: first_sense?.sd || dbEntry.sd,
    sdn: first_sense?.sdn || dbEntry.sdn,
    xs: first_sense?.xs?.[0] || dbEntry.xs,
    pf: first_sense?.pfs?.[0] || dbEntry.pf,
    sf: first_sound_file,
    // @ts-ignore
    vfs: first_sense?.vfs || dbEntry.vfs,
    nc: first_sense?.nc || dbEntry.nc,
    de: first_sense?.de || dbEntry.de,
    dictId: dictionaryId,
    hasAudio: !!first_sound_file,
    hasSpeaker: !!first_sound_file?.speakerName,
    hasImage: false,
    hasVideo: false,
    hasSemanticDomain: false,
    hasPartOfSpeech: false,
    hasNounClass: false,
    hasPluralForm: false,
  };

  delete algolia_entry.id;

  const cleaned_entry = remove_empty_fields(algolia_entry);

  if (cleaned_entry.pf?.gcs) cleaned_entry.hasImage = true;
  if (cleaned_entry.sd || cleaned_entry.sdn) cleaned_entry.hasSemanticDomain = true;
  if (cleaned_entry.ps) cleaned_entry.hasPartOfSpeech = true;
  if (cleaned_entry.nc) cleaned_entry.hasNounClass = true;
  if (cleaned_entry.pl) cleaned_entry.hasPluralForm = true;
  if (cleaned_entry.vfs?.length) cleaned_entry.hasVideo = true;

  if (cleaned_entry.createdBy) {
    cleaned_entry.cb = cleaned_entry.createdBy;
    delete cleaned_entry.createdBy;
  }

  if (cleaned_entry.updatedBy) {
    cleaned_entry.ub = cleaned_entry.updatedBy;
    delete cleaned_entry.updatedBy;
  }

  if (cleaned_entry.ua) {
    cleaned_entry.ua = (cleaned_entry.ua as any)._seconds as number;
  } else if (cleaned_entry.updatedAt) {
    cleaned_entry.ua = (cleaned_entry.updatedAt as any)._seconds as number;
    delete cleaned_entry.updatedAt;
  }

  if (cleaned_entry.ca) {
    cleaned_entry.ca = (cleaned_entry.ca as any)._seconds as number;
  } else if (cleaned_entry.createdAt) {
    cleaned_entry.ca = (cleaned_entry.createdAt as any)._seconds as number;
    delete cleaned_entry.createdAt;
  }

  return cleaned_entry;
}

export function remove_empty_fields<T>(entry: T): T {
  Object.keys(entry).forEach((key) => {
    const value = entry[key];
    if (value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
      delete entry[key];
    }
  });
  return entry;
}

async function get_first_sound_file(dbEntry: ActualDatabaseEntry,
  db: firestore.Firestore): Promise<ActualDatabaseAudio> {
  const first_sound_file = dbEntry.sfs?.[0] || dbEntry.sf;
  if (!first_sound_file?.path) return null;
  if (first_sound_file?.speakerName) return first_sound_file as ActualDatabaseAudio;

  const first_speaker_id = typeof first_sound_file.sp === 'string' ? first_sound_file.sp : first_sound_file.sp?.[0];

  if (first_speaker_id) {
    first_sound_file.speakerName = await get_speaker_display_name(first_speaker_id, db);
  }

  return first_sound_file as ActualDatabaseAudio;
}

export async function get_speaker_display_name(speaker_id: string, db: firestore.Firestore): Promise<string | null> {
  const speakerSnap = await db.doc(`speakers/${speaker_id}`).get();

  const speaker = speakerSnap.data();
  if (speaker?.displayName)
    return speaker.displayName;

  const userSnap = await db.doc(`users/${speaker_id}`).get();
  const user = userSnap.data();
  if (user?.displayName)
    return user.displayName;

  return null;
}