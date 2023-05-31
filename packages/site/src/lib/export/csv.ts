import type { IDictionary, IUser } from '@living-dictionaries/types';
import { prepareDictionariesForCsv } from './prepareDictionariesForCsv';

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

export function exportDictionariesAsCSV(dictionaries: IDictionary[], title: string, admin = 0) {
  const all_dictionaries = prepareDictionariesForCsv(dictionaries, admin);
  const blob = arrayToCSVBlob(all_dictionaries);
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
