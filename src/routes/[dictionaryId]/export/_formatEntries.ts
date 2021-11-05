import type { IDictionary, IEntry } from '$lib/interfaces';
import { glossingLanguages } from './_glossing-languages-temp';
import { semanticDomains } from '$lib/mappings/semantic-domains';
import { partsOfSpeech } from '$lib/mappings/parts-of-speech';
import { fetchSpeakers } from '$lib/helpers/fetchSpeakers';
import { friendlyName } from '$lib/helpers/friendlyName';

function turnArrayIntoPipedString(itemsFormatted, i, values, columnName, fn) {
  if (values) {
    let stringValue = '';
    // There are some dictionaries (e.g. Kalanga) that have strings as sources instead of arrays
    values = typeof values === 'string' ? [values] : values;
    const list = values.map(fn);
    //In case some strings contain commas
    stringValue += list.map((el) => el.replace(/,/g, ' -'));
    stringValue = stringValue.replace(/,/g, ' | ');
    Object.assign(itemsFormatted[i], JSON.parse(`{"${columnName}": "${stringValue}"}`));
  } else {
    Object.assign(itemsFormatted[i], JSON.parse(`{ "${columnName}": "" }`));
  }
}

export async function formatEntriesForCSV(
  data: IEntry[],
  { name: dictionaryName, glossLanguages }: IDictionary
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

  const speakers = await fetchSpeakers(data);

  const headers = {
    id: 'Entry id',
    lx: 'Lexeme/Word/Phrase',
    ph: 'Phonetic (IPA)',
    in: 'Interlinearization',
    mr: 'Morphology',
    di: 'Dialect for this entry',
    nt: 'Notes',
    psab: 'Parts of speech abbreviation',
    ps: 'Parts of speech',
    sr: 'Source(s)',
  };

  //Assigning semantic domains as headers
  if (totalSDN > 0) {
    for (let index = 0; index < totalSDN; index++) {
      Object.assign(headers, JSON.parse(`{"sd${index + 1}": "Semantic domain ${index + 1}"}`));
    }
  }

  //Assigning gloss languages as gloss headers
  glossLanguages.forEach((bcp) => {
    Object.assign(headers, JSON.parse(`{ "gl${bcp}": "${glossingLanguages[bcp]} Gloss" }`));
  });

  //Assigning vernacular and gloss languages as example sentence headers
  Object.assign(headers, JSON.parse(`{"xsvn": "Example sentence in ${dictionaryName}"}`));
  glossLanguages.forEach((bcp) => {
    Object.assign(
      headers,
      JSON.parse(`{"xs${bcp}": "Example sentence in ${glossingLanguages[bcp]}"}`)
    );
  });

  //Assigning audio metadata as headers
  Object.assign(headers, {
    auFriendlyName: 'Audio filename',
    ausn: 'Speaker name',
    aubp: 'Speaker birthplace',
    aude: 'Speaker decade',
    auge: 'Speaker gender',
  });

  //Assigning images metadata as headers
  Object.assign(headers, {
    imFriendlyName: 'Image filename',
  });

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
      di: entry.di ? entry.di.replace(/[,"\r\n]/g, (m) => replacementChars[m]) : '',
      nt: entry.nt ? entry.nt.replace(/[,"\r\n]/g, (m) => replacementChars[m]) : '',
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
    if (entry.sdn) {
      for (let index = 0; index < totalSDN; index++) {
        Object.assign(
          itemsFormatted[i],
          JSON.parse(
            `{"sd${index + 1}": "${
              entry.sdn[index]
                ? semanticDomains
                    .find((sd) => sd.key === entry.sdn[index])
                    ?.name.replace(/[,"\r\n]/g, (m) => replacementChars[m]) || ''
                : ''
            }"}`
          )
        );
      }
    } else {
      for (let index = 0; index < totalSDN; index++) {
        Object.assign(
          itemsFormatted[i],
          JSON.parse(`{
            "sd${index + 1}": ""
          }`)
        );
      }
    }
    //Assigning glosses
    glossLanguages.forEach((bcp) => {
      const cleanEntry = entry.gl[bcp]
        ? entry.gl[bcp].replace(/[,"\r\n]/g, (m) => replacementChars[m])
        : '';
      Object.assign(itemsFormatted[i], JSON.parse(`{"gl${bcp}": "${cleanEntry}"}`));
    });
    //Assigning example sentences
    for (let j = 0; j <= glossLanguages.length; j++) {
      if (entry.xs) {
        if (j === glossLanguages.length) {
          Object.assign(
            itemsFormatted[i],
            JSON.parse(`{
              "xs${glossLanguages[j] ? glossLanguages[j] : 'vn'}": "${
              entry.xs['vn'] ? entry.xs['vn'].replace(/[,"\r\n]/g, (m) => replacementChars[m]) : ''
            }"
            }`)
          );
        } else {
          Object.assign(
            itemsFormatted[i],
            JSON.parse(`{
              "xs${glossLanguages[j] ? glossLanguages[j] : 'vn'}": "${
              entry.xs[glossLanguages[j]] ? entry.xs[glossLanguages[j]] : ''
            }"
            }`)
          );
        }
      } else {
        Object.assign(
          itemsFormatted[i],
          JSON.parse(`{
            "xs${glossLanguages[j] ? glossLanguages[j] : 'vn'}": ""
          }`)
        );
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
        aupa: entry.sf.path,
        auFriendlyName: friendlyName(entry, entry.sf.path),
        ausn: speakerName,
        aubp: speakerBP,
        aude: speakerDecade,
        auge: speakerGender,
      });
    } else {
      Object.assign(itemsFormatted[i], {
        auFriendlyName: '',
        ausn: '',
        aubp: '',
        aude: '',
        auge: '',
      });
    }

    if (entry.pf && entry.pf.path) {
      Object.assign(itemsFormatted[i], {
        impa: entry.pf.path,
        imFriendlyName: friendlyName(entry, entry.pf.path),
      });
    } else {
      Object.assign(itemsFormatted[i], { imFriendlyName: '' });
    }
    i++;
  });
  itemsFormatted.unshift(headers);
  return itemsFormatted;
}
