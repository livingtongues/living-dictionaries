import type { IUser } from '$lib/interfaces';
import { user } from '$sveltefire/user';
import { derived } from 'svelte/store';

export const admin = derived(user, ($user: IUser) => {
  if ($user && $user.roles && $user.roles.admin && $user.roles.admin > 0) {
    return $user.roles.admin;
  } else {
    return false;
  }
});

function convertToCSV(objArray) {
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

export function exportCSVFile(data: IUser[], title) {
  const headers = {
    displayName: 'Name',
    email: 'Email',
  };

  const itemsFormatted = [];
  data.forEach((user) => {
    itemsFormatted.push({
      displayName: user.displayName,
      email: user.email,
    });
  });

  if (headers) {
    itemsFormatted.unshift(headers);
  }

  // Convert Object to JSON
  const jsonObject = JSON.stringify(itemsFormatted);

  const csv = convertToCSV(jsonObject);

  const d = new Date();
  const date = d.getMonth() + 1 + '_' + d.getDate() + '_' + d.getFullYear();
  const exportedFilename = title + '_' + date + '.csv' || 'export.csv';

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  if (navigator.msSaveBlob) {
    // IE 10+
    navigator.msSaveBlob(blob, exportedFilename);
  } else {
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
}
