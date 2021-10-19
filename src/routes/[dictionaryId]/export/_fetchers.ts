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
