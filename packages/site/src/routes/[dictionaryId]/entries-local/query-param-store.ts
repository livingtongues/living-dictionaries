import { writable, type Writable } from 'svelte/store';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { cleanObject } from './clean-object';

export interface QueryParamStore<T> extends Writable<T> {
  remove: () => void;
}

export interface QueryParamStoreOptions<T> {
  key: string;
  startWith?: T;
  replaceState?: boolean;
  persist?: 'localStorage' | 'sessionStorage';
  storagePrefix?: string;
  log?: boolean;
}

const stringify = (value) => {
  if (typeof value === 'undefined' || value === null || value === '') return undefined;
  if (typeof value === 'string') return value;

  const cleanedValue = cleanObject(value);
  return cleanedValue === undefined ? undefined : JSON.stringify(cleanedValue);
};

const parse = (value: string) => {
  if (typeof value === 'undefined') return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value; // if the original input was just a string (and never JSON stringified), it will throw an error so just return the string
  }
};

export function createQueryParamStore<T>(opts: QueryParamStoreOptions<T>) {
  const { key, log, persist, startWith } = opts;
  const replaceState = typeof opts.replaceState === 'undefined' ? true : opts.replaceState;
  const storageKey = `${opts.storagePrefix || ''}${key}`

  let storage: Storage = undefined
  if (typeof window !== 'undefined') {
    if (persist === 'localStorage')
      storage = localStorage;
    if (persist === 'sessionStorage')
      storage = sessionStorage;
  }

  const setQueryParam = (value) => {
    if (typeof window === 'undefined') return; // safety check in case store value is assigned via $: call server side
    const stringified_value = stringify(value);
    if (stringified_value === undefined) return removeQueryParam();
    const {hash} = window.location
    const searchParams = new URLSearchParams(window.location.search)
    searchParams.set(key, stringify(value));
    goto(`?${searchParams}${hash}`, { keepFocus: true, noScroll: true, replaceState });
    if (log) console.info(`user action changed: ${key} to ${value}`);
  };

  const updateQueryParam = (fn: (value: T) => T) => {
    const searchParams = new URLSearchParams(window.location.search)
    const value = searchParams.get(key);
    const parsed_value = parse(value) as T;
    setQueryParam(fn(parsed_value));
  }

  const removeQueryParam = () => {
    const {hash} = window.location
    const searchParams = new URLSearchParams(window.location.search)
    searchParams.delete(key);
    goto(`?${searchParams}${hash}`, { keepFocus: true, noScroll: true, replaceState });
    if (log) console.info(`user action removed: ${key}`);
  };

  const setStoreValue = (value: string) => {
    if (log) console.info(`URL set ${key} to ${value}`);
    let parsed_value = parse(value) as T;
    if (!parsed_value && typeof startWith === 'object')
      parsed_value = {} as T;
    set(parsed_value);
    storage?.setItem(storageKey, JSON.stringify(parsed_value));
    if (log && storage) console.info({[storageKey + '_to_cache']: parsed_value});
  };

  let firstUrlCheck = true;

  const start = () => {
    const unsubscribe_from_page_store = page.subscribe(({ url: { searchParams } }) => {
      let value = searchParams.get(key);

      // Set store value from url - skipped on first load
      if (!firstUrlCheck) return setStoreValue(value);
      firstUrlCheck = false;

      // 1st Priority: check url query param for value
      if (value !== undefined && value !== null && value !== '') return setStoreValue(value);

      if (typeof window === 'undefined') return;

      // 2nd Priority: check localStorage/sessionStorage for value
      if (persist) {
        value = JSON.parse(storage.getItem(storageKey));
        if (log) console.info({[storageKey + '_from_cache']: value});
      }

      if (value) return setQueryParam(value);
    });

    return () => unsubscribe_from_page_store();
  };

  // 3rd Priority: use startWith if no query param in url nor storage value found
  const store = writable<T>(startWith, start);
  const { subscribe, set } = store;

  return {
    subscribe,
    set: setQueryParam,
    update: updateQueryParam,
    remove: removeQueryParam,
  };
}

// SvelteKit Goto dicussion https://github.com/sveltejs/kit/issues/969
