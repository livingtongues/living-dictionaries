import type {
  IDictionary,
  IEntry,
  IPartOfSpeech,
  ISemanticDomain,
  ISpeaker,
} from '@living-dictionaries/types';
import { glossingLanguages } from './glossing-languages-temp'; // todo - import from actual json file
import { friendlyName } from './friendlyName';
import { stripHTMLTags } from './stripHTMLTags';

enum EntryCSVFieldsEnum {
  id = 'Entry Id',
  lx = 'Lexeme/Word/Phrase',
  ph = 'Phonetic (IPA)',
  in = 'Interlinearization',
  nc = 'Noun class',
  mr = 'Morphology',
  pl = 'Plural form',
  di = 'Dialect',
  nt = 'Notes',
  sr = 'Source(s)',
  psab = 'Part of Speech abbreviation',
  ps = 'Part of Speech',
  sfFriendlyName = 'Audio filename',
  sfsn = 'Speaker name',
  sfbp = 'Speaker birthplace',
  sfde = 'Speaker decade',
  sfge = 'Speaker gender',
  pfFriendlyName = 'Image filename',
}
type EntryForCSVKeys = keyof typeof EntryCSVFieldsEnum;
type EntryForCSV = {
  [key in EntryForCSVKeys]?: string;
};
export interface IEntryForCSV extends EntryForCSV {
  xsvn?: string;
  va?: string; // optional for Babanki
  sfpa?: string; // for downloading file, not exported in CSV
  pfpa?: string; // for downloading file, not exported in CSV
}

export function formatEntriesForCSV(
  entries: IEntry[],
  { name: dictionaryName, id: dictionaryId, glossLanguages }: IDictionary,
  speakers: ISpeaker[],
  semanticDomains: ISemanticDomain[],
  partsOfSpeech: IPartOfSpeech[]
) {
  const headers = {} as IEntryForCSV;
  for (const key in EntryCSVFieldsEnum) {
    headers[key] = EntryCSVFieldsEnum[key];
  }

  // Begin dynamic headers

  // Assign max number of semantic domains used by a single entry
  const maxSDN = Math.max(...entries.map((entry) => entry.sdn?.length || 0));
  if (maxSDN > 0) {
    for (let index = 0; index < maxSDN; index++) {
      headers[`sd${index + 1}`] = `Semantic domain ${index + 1}`;
    }
  }

  // glosses
  glossLanguages.forEach((bcp) => {
    headers[`gl${bcp}`] = `${glossingLanguages[bcp]} Gloss`;
  });

  // Vernacular and gloss language example sentence headers
  headers.xsvn = `Example sentence in ${dictionaryName}`;
  glossLanguages.forEach((bcp) => {
    headers[`xs${bcp}`] = `Example sentence in ${glossingLanguages[bcp]}`;
  });

  // Dictionary specific
  if (dictionaryId === 'babanki') {
    headers.va = 'variant';
  }

  const formattedEntries: IEntryForCSV[] = entries.map((entry) => {
    const formattedEntry = {
      id: entry.id,
      lx: entry.lx,
      ph: entry.ph,
      in: entry.in,
      nc: entry.nc,
      mr: entry.mr,
      pl: entry.pl,
      di: entry.di,
      nt: stripHTMLTags(entry.nt),
      sr: entry.sr ? typeof entry.sr === 'string' ? entry.sr : entry.sr.join(' | ') : '', // some dictionaries (e.g. Kalanga) have sources that are strings and not arrays
      psab: '',
      ps: '',
      sfFriendlyName: '',
      sfsn: '',
      sfbp: '',
      sfde: '',
      sfge: '',
      pfFriendlyName: '',
    } as IEntryForCSV;

    // part of speech (abbreviation & name)
    if (entry.ps) {
      const fullPos = partsOfSpeech.find((ps) => ps.enAbbrev === entry.ps)?.enName;
      if (!fullPos) {
        formattedEntry.ps = entry.ps;
      } else {
        formattedEntry.psab = entry.ps;
        formattedEntry.ps = fullPos;
      }
    }

    // Media
    if (entry.sf?.path) {
      const speaker = speakers.find((speaker) => speaker?.id === entry.sf.sp);
      const speakerName = speaker?.displayName || entry.sf.speakerName;
      formattedEntry.sfpa = entry.sf.path;
      formattedEntry.sfFriendlyName = friendlyName(entry, entry.sf.path);
      formattedEntry.sfsn = speakerName;
      formattedEntry.sfbp = speaker?.birthplace;
      formattedEntry.sfde = speaker?.decade?.toString();
      formattedEntry.sfge = speaker?.gender;
    }
    if (entry.pf?.path) {
      formattedEntry.pfpa = entry.pf.path;
      formattedEntry.pfFriendlyName = friendlyName(entry, entry.pf.path);
    }

    // Begin dynamic values

    // semantic domains
    for (let index = 0; index < maxSDN; index++) {
      formattedEntry[`sd${index + 1}`] = '';
      if (entry.sdn && entry.sdn[index]) {
        const matchingDomain = semanticDomains.find((sd) => sd.key === entry.sdn[index]);
        if (matchingDomain) {
          formattedEntry[`sd${index + 1}`] = matchingDomain.name;
        }
      }
    }

    // glosses
    glossLanguages.forEach((bcp) => {
      const cleanEntry = stripHTMLTags(entry.gl[bcp]);
      formattedEntry[`gl${bcp}`] = cleanEntry;
    });

    // Vernacular and gloss language example sentences
    formattedEntry.xsvn = entry.xs?.vn;
    glossLanguages.forEach((bcp) => {
      formattedEntry[`xs${bcp}`] = entry.xs?.[bcp];
    });

    // Dictionary specific
    if (dictionaryId === 'babanki') {
      formattedEntry.va = entry.va;
    }

    return formattedEntry;
  });
  return [headers, ...formattedEntries];
}
