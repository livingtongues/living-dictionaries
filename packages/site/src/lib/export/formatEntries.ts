import type {
  IDictionary,
  IEntry,
  IPartOfSpeech,
  ISemanticDomain,
  ISpeaker,
} from '@living-dictionaries/types';
import { glossingLanguages } from './glossing-languages-temp';
import { friendlyName } from './friendlyName';
import { replaceHTMLTags } from './replaceHTMLTags';

function turnArrayIntoPipedString(sources: string | string[]) {
  if (sources) {
    // There are some dictionaries (e.g. Kalanga) that have strings as sources instead of arrays
    const sourceArr = typeof sources === 'string' ? [sources] : sources;
    //In case some strings contain commas
    return sourceArr.map((el) => el.replace(/,/g, ' -')).join(' | ');
  }
  return '';
}

const replacementChars = {
  ',': ' -',
  '"': "'",
};

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
interface IEntryForCSV extends EntryForCSV {
  xsvn?: string;
  va?: string; // optional for Babanki
  sfpa?: string; // for downloading file, not exported in CSV
  pfpa?: string; // for downloading file, not exported in CSV
}

export function formatEntriesForCSV(
  entries: IEntry[],
  { name: dictionaryName, glossLanguages }: IDictionary,
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
  if (dictionaryName === 'Babanki') {
    headers.va = 'variant';
  }

  const formattedEntries: IEntryForCSV[] = entries.map((entry) => {
    // Replace null values with empty string
    Object.keys(entry).forEach((key) => (!entry[key] ? (entry[key] = '') : entry[key]));

    const formattedEntry = {
      id: entry.id,
      lx: entry.lx.replace(/[,"\r\n]/g, (m) => replacementChars[m]),
      ph: entry.ph?.replace(/[,"\r\n]/g, (m) => replacementChars[m]) || '',
      in: entry.in?.replace(/[,"\r\n]/g, (m) => replacementChars[m]) || '',
      nc: entry.nc?.replace(/[,"\r\n]/g, (m) => replacementChars[m]) || '',
      mr: entry.mr?.replace(/[,"\r\n]/g, (m) => replacementChars[m]) || '',
      pl: entry.pl?.replace(/[,"\r\n]/g, (m) => replacementChars[m]) || '',
      di: entry.di?.replace(/[,"\r\n]/g, (m) => replacementChars[m]) || '',
      nt: entry.nt
        ? replaceHTMLTags(entry.nt.replace(/[,"\r\n]/g, (m) => replacementChars[m]))
        : '',
      sr: turnArrayIntoPipedString(entry.sr) || '',
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
      const speakerName = speaker?.displayName || entry.sf.speakerName || '';
      formattedEntry.sfpa = entry.sf.path;
      formattedEntry.sfFriendlyName = friendlyName(entry, entry.sf.path);
      formattedEntry.sfsn = speakerName.replace(/[,"\r\n]/g, (m) => replacementChars[m]);
      formattedEntry.sfbp =
        speaker?.birthplace?.replace(/[,"\r\n]/g, (m) => replacementChars[m]) || '';
      formattedEntry.sfde = speaker?.decade?.toString() || ''; // test both string and number
      formattedEntry.sfge = speaker?.gender || '';
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
          formattedEntry[`sd${index + 1}`] = matchingDomain.name.replace(
            /[,"\r\n]/g,
            (m) => replacementChars[m]
          );
        }
      }
    }

    // glosses
    glossLanguages.forEach((bcp) => {
      const cleanEntry = entry.gl[bcp]
        ? replaceHTMLTags(entry.gl[bcp].replace(/[,"\r\n]/g, (m) => replacementChars[m]))
        : '';
      formattedEntry[`gl${bcp}`] = cleanEntry;
    });

    // Vernacular and gloss language example sentences
    formattedEntry.xsvn = entry.xs?.vn || '';
    glossLanguages.forEach((bcp) => {
      formattedEntry[`xs${bcp}`] =
        entry.xs?.[bcp]?.replace(/[,"\r\n]/g, (m) => replacementChars[m]) || '';
    });

    // Dictionary specific
    if (dictionaryName === 'Babanki') {
      formattedEntry.va = entry.va || '';
    }

    return formattedEntry;
  });
  return [headers, ...formattedEntries];
}
