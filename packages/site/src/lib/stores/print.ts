import { writable, derived } from 'svelte/store';
import type { IPrintSettings } from '@living-dictionaries/types';
import { browser } from '$app/env';

let defaultSettings: IPrintSettings;
let cachedSettings: IPrintSettings;
if (browser) {
  cachedSettings = JSON.parse(localStorage.getItem('TestSettings'));
}

export const preferredSettings = writable(cachedSettings || defaultSettings);

if (browser) {
  preferredSettings.subscribe((selectedSettings) =>
    localStorage.setItem('TestSettings', JSON.stringify(selectedSettings))
  );
}
