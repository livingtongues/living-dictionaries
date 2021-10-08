import type { IDictionary, IEntry, IUser } from '$lib/interfaces';
import { dictionary } from 'svelte-i18n';
import { glossingLanguages } from './glossing-languages-temp';
import { semanticDomains } from '$lib/mappings/semantic-domains';

export function convertToCSV(objArray) {
  const array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
  let str = '';

  for (let i = 0; i < array.length; i++) {
    let line = '';
    for (const index in array[i]) {
      if (line != '') line += ',';

      line += array[i][index];
    }

    str += line + '\r\n';
  }

  return str;
}

export function downloadObjectAsCSV(itemsFormatted: Record<string, unknown>[], title: string) {
  function replacer(_, value: any) {
    // Filtering out properties
    if (value === undefined || value === null) {
      return '';
    }
    return value;
  }
  const jsonObject = JSON.stringify(itemsFormatted, replacer);

  const csv = convertToCSV(jsonObject);

  const d = new Date();
  const date = d.getMonth() + 1 + '_' + d.getDate() + '_' + d.getFullYear();
  const exportedFilename = title + '_' + date + '.csv' || 'export.csv';

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    // feature detection
    // Browsers that support HTML5 download attribute
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', exportedFilename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function valuesInColumn(itemsFormatted, i, values, columnName, fn) {
  if (values) {
    let stringValue = '';
    const list = values.map(fn);
    stringValue += list.map((el) => el.replace(/,/g, ' -'));
    stringValue = stringValue.replace(/,/g, ' | ');
    Object.assign(itemsFormatted[i], JSON.parse(`{"${columnName}": "${stringValue}"}`));
  } else {
    Object.assign(itemsFormatted[i], JSON.parse(`{ "${columnName}": "" }`));
  }
}

export function exportDictionariesAsCSV(data: IDictionary[], title: string) {
  const headers = {
    name: 'Dictionary Name',
    url: 'URL',
    iso6393: 'ISO 639-3',
    glottocode: 'Glottocode',
    location: 'Location',
    latitude: 'Latitude',
    longitude: 'Longitude',
    thumbnail: 'Thumbnail',
  };

  const itemsFormatted = [];
  data.forEach((dictionary) => {
    let cleanedLocation = '';
    if (dictionary.location) {
      const location = dictionary.location + '';
      cleanedLocation = location.replace(/,/g, '_');
    }

    itemsFormatted.push({
      name: dictionary.name.replace(/,/g, '_'),
      url: dictionary.url,
      iso6393: dictionary.iso6393 || '',
      glottocode: dictionary.glottocode || '',
      location: cleanedLocation,
      latitude: (dictionary.coordinates && dictionary.coordinates.latitude) || '',
      longitude: (dictionary.coordinates && dictionary.coordinates.longitude) || '',
      thumbnail: dictionary.thumbnail || '',
    });
  });

  itemsFormatted.unshift(headers);
  downloadObjectAsCSV(itemsFormatted, title);
}

export function exportUsersAsCSV(data: IUser[], title: string) {
  const headers = {
    displayName: 'Name',
    email: 'Email',
  };

  const itemsFormatted = [];
  data.forEach((user) => {
    itemsFormatted.push({
      displayName: user.displayName && user.displayName.replace(/,/, ''),
      email: user.email,
    });
  });

  itemsFormatted.unshift(headers);
  downloadObjectAsCSV(itemsFormatted, title);
}
//TODO fix parts-of-speech
export function exportEntriesAsCSV(data: IEntry[], title: string, glosses: string[]) {
  const headers = {
    lx: 'Lexeme/Word/Phrase',
    ph: 'Phonetic (IPA)',
    in: 'Interlinearization',
    mr: 'Morphology',
    ps: 'Parts of speech',
    di: 'Dialect for this entry',
    nt: 'Notes',
    sr: 'Source(s)',
    sd: 'Semantic domain',
    //xv: 'Example vernacular', //?
  };

  const itemsFormatted = [];
  data.forEach((entry, i) => {
    //Avoiding showing null values
    const entryKeys = Object.keys(entry);
    entryKeys.forEach((key) => (!entry[key] ? (entry[key] = '') : entry[key]));
    itemsFormatted.push({
      lx: entry.lx,
      ph: entry.ph,
      in: entry.in,
      mr: entry.mr,
      ps: entry.ps,
      di: entry.di,
      nt: entry.nt,
      //TODO sd,
      //xv: entry.xv,
    });
    //Assigning sources
    valuesInColumn(itemsFormatted, i, entry.sr, 'sr', (el) => el);
    //Assigning semantic domains
    valuesInColumn(itemsFormatted, i, entry.sdn, 'sd', (el) => {
      const objSD = semanticDomains.find((sd) => sd.key === el);
      return objSD.name;
    });
    //Assigning glosses
    glosses.forEach((bcp) => {
      Object.assign(headers, JSON.parse(`{ "gl${bcp}": "${glossingLanguages[bcp]} Gloss" }`));
      Object.assign(
        itemsFormatted[i],
        JSON.parse(`{
        "gl${bcp}": "${entry.gl[bcp] ? entry.gl[bcp] : ''}"
      }`)
      );
    });
    //Assigning example sentences. There's no way to do this in a declarative form.
    for (let j = 0; j <= glosses.length; j++) {
      if (j === glosses.length) {
        Object.assign(headers, JSON.parse(`{"xs${title}": "Example sentence in ${title}"}`));
        if (entry.xs) {
          Object.assign(
            itemsFormatted[i],
            JSON.parse(`{
          "xs${title}": "${entry.xs['vn'] ? entry.xs['vn'] : ''}"
        }`)
          );
        }
      } else {
        Object.assign(
          headers,
          JSON.parse(`{"xs${glosses[j]}": "Example sentence in ${glossingLanguages[glosses[j]]}"}`)
        );
        // I think it can be refactored
        if (entry.xs) {
          Object.assign(
            itemsFormatted[i],
            JSON.parse(`{
            "xs${glosses[j]}": "${entry.xs[glosses[j]] ? entry.xs[glosses[j]] : ''}"
          }`)
          );
        } else {
          Object.assign(
            itemsFormatted[i],
            JSON.parse(`{
            "xs${glosses[j]}": ""
          }`)
          );
        }
      }
    }
    i++;
  });
  //TESTING
  console.dir(itemsFormatted);

  itemsFormatted.unshift(headers);
  downloadObjectAsCSV(itemsFormatted, title);
}
