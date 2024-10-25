// import { getDocument } from 'sveltefirets';
// import type { ISpeaker, ExpandedEntry } from '@living-dictionaries/types';

// export async function fetchSpeakers(entries: ExpandedEntry[]): Promise<ISpeaker[]> {
//   let speaker_ids: string[] = [];
//   for (const { sound_files } of entries) {
//     const ids = sound_files?.[0]?.speaker_ids || [];
//     speaker_ids = speaker_ids.concat(ids);
//   }

//   const speakers = await Promise.all(speaker_ids.map(async (id) => await getDocument<ISpeaker>(`speakers/${id}`)));
//   return speakers;
// }
