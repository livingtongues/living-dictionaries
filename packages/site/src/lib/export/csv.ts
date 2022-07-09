import type { IDictionary, IUser } from '@living-dictionaries/types';

function objectsToCSV(arr: Record<string, string>[]) {
  const array = [Object.keys(arr[0]), ...arr];
  return array
    .map((row) => {
      return Object.values(row)
        .map((value) => {
          if (value === null || value === undefined) return '';
          if (value.includes(',') || value.includes('"')) return `"${value.replace(/"/g, '""')}"`;
          return value;
        })
        .toString();
    })
    .join('\n');
}

export function fileAsBlob(itemsFormatted: Record<string, string | any>[]) {
  const csv = objectsToCSV(itemsFormatted);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  return blob;
}

export function downloadObjArrAsCSV(itemsFormatted: Record<string, string | any>[], title: string) {
  const blob = fileAsBlob(itemsFormatted);
  const d = new Date();
  const date = d.getMonth() + 1 + '_' + d.getDate() + '_' + d.getFullYear();
  const exportedFilename = title + '_' + date + '.csv' || 'export.csv';

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
  downloadObjArrAsCSV(itemsFormatted, title);
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
  downloadObjArrAsCSV(itemsFormatted, title);
}
