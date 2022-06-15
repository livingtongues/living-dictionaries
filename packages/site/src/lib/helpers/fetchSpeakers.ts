import { getDocument } from '$sveltefirets';
import type { ISpeaker, IEntry } from '@living-dictionaries/types';

export async function fetchSpeakers(data: IEntry[]) {
  const speakersIds = [];
  const speakers: ISpeaker[] = [];
  data.forEach((entry) => {
    entry.sf && !speakersIds.includes(entry.sf.sp) ? speakersIds.push(entry.sf.sp) : '';
  });
  for (let i = 0; i < speakersIds.length; i++) {
    speakers.push(await getDocument<ISpeaker>(`speakers/${speakersIds[i]}`));
  }
  return speakers;
}

export async function fetchSpeaker(speakerId: string) {
  const speaker = await getDocument<ISpeaker>(`speakers/${speakerId}`);
  return speaker;
}
