import type { IDictionary, IUser } from '@living-dictionaries/types';

export function objectsToCSV(array: Record<string, any>[]) {
  return array
    .map((row) => {
      return Object.values(row)
        .map((value) => {
          if (value === null || value === undefined) return '';
          if (isNaN(value) && (value.includes(',') || value.includes('"')))
            return `"${value.replace(/"/g, '""')}"`;
          return value;
        })
        .toString();
    })
    .join('\n');
}

export function arrayToCSVBlob(itemsFormatted: Record<string, any>[]) {
  const csv = objectsToCSV(itemsFormatted);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  return blob;
}

export function downloadBlob(blob: Blob, title: string, extension: string) {
  const d = new Date();
  const date = d.getMonth() + 1 + '_' + d.getDate() + '_' + d.getFullYear();
  const exportedFilename = title + '_' + date + extension;

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
  } else {
    alert('This browser does not support HTML5 downloads - please use a newer browser');
  }
}

export function exportDictionariesAsCSV(dictionaries: IDictionary[], title: string) {
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

  const formattedDictionaries = dictionaries.map((dictionary) => {
    let cleanedLocation = '';
    if (dictionary.location) {
      const location = dictionary.location + '';
      cleanedLocation = location.replace(/,/g, '_');
    }

    return {
      name: dictionary.name.replace(/,/g, '_'),
      url: dictionary.url,
      iso6393: dictionary.iso6393 || '',
      glottocode: dictionary.glottocode || '',
      location: cleanedLocation,
      latitude: (dictionary.coordinates && dictionary.coordinates.latitude) || '',
      longitude: (dictionary.coordinates && dictionary.coordinates.longitude) || '',
      thumbnail: dictionary.thumbnail || '',
    };
  });

  const blob = arrayToCSVBlob([headers, ...formattedDictionaries]);
  downloadBlob(blob, title, '.csv');
}

export function exportUsersAsCSV(users: IUser[], title: string) {
  const headers = {
    displayName: 'Name',
    email: 'Email',
  };

  const formattedUsers = users.map((user) => {
    return {
      displayName: user.displayName && user.displayName.replace(/,/, ''),
      email: user.email,
    };
  });

  const blob = arrayToCSVBlob([headers, ...formattedUsers]);
  downloadBlob(blob, title, '.csv');
}
