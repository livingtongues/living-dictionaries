import type { IDictionary, IEntry, ISpeaker } from '@living-dictionaries/types';
import { glossingLanguages } from './_glossing-languages-temp';
import { semanticDomains } from '$lib/mappings/semantic-domains';
import { partsOfSpeech } from '$lib/mappings/parts-of-speech';
import { friendlyName } from '$lib/helpers/friendlyName';
import { replaceHTMLTags } from '$lib/export/replaceHTMLTags';

function turnArrayIntoPipedString(itemsFormatted, i, values, columnName, fn) {
  if (values) {
    let stringValue = '';
    // There are some dictionaries (e.g. Kalanga) that have strings as sources instead of arrays
    values = typeof values === 'string' ? [values] : values;
    const list = values.map(fn);
    //In case some strings contain commas
    stringValue += list.map((el) => el.replace(/,/g, ' -'));
    stringValue = stringValue.replace(/,/g, ' | ');
    itemsFormatted[i][columnName] = stringValue;
  } else {
    itemsFormatted[i][columnName] = '';
  }
}

export function formatEntriesForCSV(
  data: IEntry[],
  { name: dictionaryName, glossLanguages }: IDictionary,
  speakers: ISpeaker[]
) {
  //Getting the total number of semantic domains by entry if they have at least one
  let totalSDN = 0;
  const filterSDN = data.filter((entry) => (entry.sdn ? entry.sdn.length : ''));
  if (filterSDN.length > 0) {
    totalSDN = filterSDN
      .map((entry) => entry.sdn.length)
      .reduce((maxLength, sdnLength) => Math.max(maxLength, sdnLength));
  }

  const replacementChars = {
    ',': ' -',
    '"': "'",
  };

  const headers = {
    id: 'Entry id',
    lx: 'Lexeme/Word/Phrase',
    ph: 'Phonetic (IPA)',
    in: 'Interlinearization',
    mr: 'Morphology',
    plf: 'Plural form',
    di: 'Dialect for this entry',
    nt: 'Notes',
    psab: 'Parts of speech abbreviation',
    ps: 'Parts of speech',
    sr: 'Source(s)',
  };

  //Assigning semantic domains as headers
  if (totalSDN > 0) {
    for (let index = 0; index < totalSDN; index++) {
      headers[`sd${index + 1}`] = `Semantic domain ${index + 1}`;
    }
  }

  //Assigning gloss languages as gloss headers
  glossLanguages.forEach((bcp) => {
    headers[`gl${bcp}`] = `${glossingLanguages[bcp]} Gloss`;
  });

  //Assigning vernacular and gloss languages as example sentence headers
  headers['xsvn'] = `Example sentence in ${dictionaryName}`;
  glossLanguages.forEach((bcp) => {
    headers[`xs${bcp}`] = `Example sentence in ${glossingLanguages[bcp]}`;
  });

  //Assigning audio metadata as headers
  Object.assign(headers, {
    sfFriendlyName: 'Audio filename',
    sfsn: 'Speaker name',
    sfbp: 'Speaker birthplace',
    sfde: 'Speaker decade',
    sfge: 'Speaker gender',
  });

  //Assigning images metadata as headers
  headers['pfFriendlyName'] = 'Image filename';

  const itemsFormatted = [];
  data.forEach((entry, i) => {
    // Replace null values with empty string
    const entryKeys = Object.keys(entry);
    entryKeys.forEach((key) => (!entry[key] ? (entry[key] = '') : entry[key]));

    itemsFormatted.push({
      id: entry.id,
      lx: entry.lx.replace(/[,"\r\n]/g, (m) => replacementChars[m]),
      ph: entry.ph ? entry.ph.replace(/[,"\r\n]/g, (m) => replacementChars[m]) : '',
      in: entry.in ? entry.in.replace(/[,"\r\n]/g, (m) => replacementChars[m]) : '',
      mr: entry.mr ? entry.mr.replace(/[,"\r\n]/g, (m) => replacementChars[m]) : '',
      plf: entry.plf ? entry.plf.replace(/[,"\r\n]/g, (m) => replacementChars[m]) : '',
      di: entry.di ? entry.di.replace(/[,"\r\n]/g, (m) => replacementChars[m]) : '',
      nt: entry.nt
        ? replaceHTMLTags(entry.nt.replace(/[,"\r\n]/g, (m) => replacementChars[m]))
        : '',
      //xv: entry.xv,
    });

    //Assigning parts of speech (abbreviation & name)
    if (entry.ps) {
      const pos = partsOfSpeech.find((ps) => ps.enAbbrev === entry.ps)?.enName;
      if (!pos) {
        Object.assign(
          itemsFormatted[i],
          JSON.parse(`{
          "psab": "",
          "ps": "${entry.ps}"
        }`)
        );
      } else {
        Object.assign(
          itemsFormatted[i],
          JSON.parse(`{
          "psab": "${entry.ps}",
          "ps": "${pos}"
        }`)
        );
      }
    } else {
      Object.assign(itemsFormatted[i], {
        psab: '',
        ps: '',
      });
    }

    //Assigning sources
    turnArrayIntoPipedString(itemsFormatted, i, entry.sr, 'sr', (el) => el);

    //Assigning semantic domains
    for (let index = 0; index < totalSDN; index++) {
      itemsFormatted[i][`sd${index + 1}`] = '';
      if (entry.sdn && entry.sdn[index]) {
        const matchingDomain = semanticDomains.find((sd) => sd.key === entry.sdn[index]);
        if (matchingDomain) {
          itemsFormatted[i][`sd${index + 1}`] = matchingDomain.name.replace(
            /[,"\r\n]/g,
            (m) => replacementChars[m]
          );
        }
      }
    }

    //Assigning glosses
    glossLanguages.forEach((bcp) => {
      const cleanEntry = entry.gl[bcp]
        ? replaceHTMLTags(entry.gl[bcp].replace(/[,"\r\n]/g, (m) => replacementChars[m]))
        : '';
      itemsFormatted[i][`gl${bcp}`] = cleanEntry;
    });
    //Assigning example sentences
    for (let j = 0; j <= glossLanguages.length; j++) {
      if (entry.xs) {
        if (j === glossLanguages.length) {
          itemsFormatted[i][`xs${glossLanguages[j] ? glossLanguages[j] : 'vn'}`] = `${
            entry.xs['vn'] ? entry.xs['vn'].replace(/[,"\r\n]/g, (m) => replacementChars[m]) : ''
          }`;
        } else {
          itemsFormatted[i][`xs${glossLanguages[j] ? glossLanguages[j] : 'vn'}`] = `${
            entry.xs[glossLanguages[j]] ? entry.xs[glossLanguages[j]] : ''
          }`;
        }
      } else {
        itemsFormatted[i][`xs${glossLanguages[j] ? glossLanguages[j] : 'vn'}`] = '';
      }
    }
    //Audio metadata
    if (entry.sf && entry.sf.path) {
      const speaker = speakers.find((speaker) => speaker?.id === entry.sf.sp);
      let speakerName = speaker?.displayName || entry.sf.speakerName || '';
      speakerName = speakerName.replace(/[,"\r\n]/g, (m) => replacementChars[m]);
      let speakerBP = speaker?.birthplace || '';
      speakerBP = speakerBP.replace(/[,"\r\n]/g, (m) => replacementChars[m]);
      const speakerDecade = speaker?.decade || '';
      const speakerGender = speaker?.gender || '';
      Object.assign(itemsFormatted[i], {
        sfpa: entry.sf.path,
        sfFriendlyName: friendlyName(entry, entry.sf.path),
        sfsn: speakerName,
        sfbp: speakerBP,
        sfde: speakerDecade,
        sfge: speakerGender,
      });
    } else {
      Object.assign(itemsFormatted[i], {
        sfFriendlyName: '',
        sfsn: '',
        sfbp: '',
        sfde: '',
        sfge: '',
      });
    }
    if (entry.pf && entry.pf.path) {
      itemsFormatted[i]['pfpa'] = entry.pf.path;
      itemsFormatted[i]['pfFriendlyName'] = friendlyName(entry, entry.pf.path);
    } else {
      itemsFormatted[i]['pfFriendlyName'] = '';
    }
    i++;
  });
  itemsFormatted.unshift(headers);
  return itemsFormatted;
}
