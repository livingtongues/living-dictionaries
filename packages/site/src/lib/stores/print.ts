import { writable } from 'svelte/store';
import type { IPrintFields } from '@living-dictionaries/types';
import { browser } from '$app/env';
import { defaultPrintFields } from '@living-dictionaries/parts';

let cachedPrintFields: IPrintFields;
const printFieldsCacheKey = 'print_fields_9.21.2022'; // rename when updating print fields
if (browser) {
  cachedPrintFields = JSON.parse(localStorage.getItem(printFieldsCacheKey));
}

export const preferredPrintFields = writable(cachedPrintFields || defaultPrintFields);

if (browser) {
  preferredPrintFields.subscribe((selectedPrintFields) =>
    localStorage.setItem(printFieldsCacheKey, JSON.stringify(selectedPrintFields))
  );
}
