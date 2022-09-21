import { writable } from 'svelte/store';
import type { IPrintFields } from '@living-dictionaries/types';
// import { browser } from '$app/env';
import { defaultPrintFields } from '@living-dictionaries/parts';

export const printFields = writable<IPrintFields>(defaultPrintFields);
// let cachedSettings: IPrintSettings;
// if (browser) {
//   cachedSettings = JSON.parse(localStorage.getItem('TestSettings'));
// }

// export const preferredSettings = writable(cachedSettings || defaultPrintF);

// if (browser) {
//   preferredSettings.subscribe((selectedSettings) =>
//     localStorage.setItem('TestSettings', JSON.stringify(selectedSettings))
//   );
// }
