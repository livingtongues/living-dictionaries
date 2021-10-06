import type { IDictionary, IEntry, IUser } from '$lib/interfaces';
import { dictionary } from 'svelte-i18n';
import { glossingLanguages } from './glossing-languages-temp';

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

export function exportEntriesAsCSV(data: IEntry[], title: string) {
  const headers = {
    lx: 'Lexeme/Word/Phrase',
    ph: 'Phonetic (IPA)',
    in: 'Interlinearization',
    mr: 'Morphology',
    ps: 'Parts of speech',
    sd: 'Semantic domain',
    di: 'Dialect for this entry',
    nt: 'Notes',
    //sr: 'Source(s)',
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
    if (entry.gl) {
      Object.keys(entry.gl).forEach((bcp) => {
        if (glossingLanguages[bcp]) {
          Object.assign(headers, JSON.parse(`{ "${bcp}": "${glossingLanguages[bcp]} Gloss" }`));
          Object.assign(
            itemsFormatted[i],
            JSON.parse(`{
              "gl${bcp}": "${entry.gl[bcp]}"
            }`)
          );
        }
      });
    }
    if (entry.xs) {
      Object.keys(entry.xs).forEach((bcp) => {
        Object.assign(
          headers,
          glossingLanguages[bcp]
            ? JSON.parse(`{"xs${bcp}": "Example sentence in ${glossingLanguages[bcp]}"}`)
            : JSON.parse(`{"xs${bcp}": "Example sentence in ${title}"}`)
        );
        Object.assign(
          itemsFormatted[i],
          JSON.parse(`{
            "${bcp}": "${entry.xs[bcp]}"
          }`)
        );
      });
    }
    i++;
  });
  //TESTING
  console.dir(itemsFormatted);

  itemsFormatted.unshift(headers);
  downloadObjectAsCSV(itemsFormatted, title);
}
