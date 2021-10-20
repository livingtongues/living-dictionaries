import type { IEntry, ISpeaker } from '$lib/interfaces';
import { getCollection } from '$sveltefire/firestore';
import { exportEntriesAsCSV } from '$lib/export/csv';

export async function downloadEntries(
  id: string,
  name: string,
  glosses: string[],
  includeAudios = false,
  includeImages = false
) {
  const dataEntries = await getCollection<IEntry>(`dictionaries/${id}/words`);
  if (includeImages && includeAudios) {
    await exportEntriesAsCSV(dataEntries, name, glosses, true, true);
  } else if (includeAudios) {
    await exportEntriesAsCSV(dataEntries, name, glosses, true);
  } else if (includeImages) {
    await exportEntriesAsCSV(dataEntries, name, glosses, false, true);
  } else {
    await exportEntriesAsCSV(dataEntries, name, glosses);
  }
}

type MediaObject = {
  audio: boolean;
  images: boolean;
};

export async function haveMediaFile(id: string): Promise<MediaObject> {
  const mediaObject = { audio: false, images: false };
  const dataEntries = await getCollection<IEntry>(`dictionaries/${id}/words`);
  const resultImages = dataEntries.find((entry) => entry.pf);
  const resultAudio = dataEntries.find((entry) => entry.sf);
  if (resultImages) {
    mediaObject.images = true;
  }
  if (resultAudio) {
    mediaObject.audio = true;
  }
  return mediaObject;
}
