import { CollectionReference, FirestoreError, QueryConstraint, getDocs, getDocsFromCache, limit, orderBy, query, startAt } from 'firebase/firestore';
import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
import type { TranslateFunction } from '$lib/i18n/types';
import { create_index, search_entries } from '$lib/search';
import { browser } from '$app/environment';
import type { IDictionary, ExpandedEntry, ActualDatabaseEntry } from '@living-dictionaries/types';
import { writable } from 'svelte/store';
import { firebaseConfig, colRef } from 'sveltefirets';

async function getCollectionOrError<T>(
  path: string | CollectionReference<T>,
  queryConstraints: QueryConstraint[] = [],
  { fromCache } = { fromCache: false },
): Promise<{ data?: T[], ref?: CollectionReference<T>, error?: FirestoreError }> {
  try {
    const _ref = typeof path === 'string' ? colRef<T>(path) : path;
    const q = query(_ref, ...queryConstraints);
    const collectionSnap = fromCache ? await getDocsFromCache(q) : await getDocs(q);
    return {
      data: collectionSnap.docs.map((docSnap) => ({
        ...docSnap.data(),
        id: docSnap.id,
      })),
      ref: _ref,
    }
  } catch (error) {
    return { error };
  }
}

export function create_entries_store({dictionary, is_admin, t, entries_per_page}: { dictionary: IDictionary, is_admin: boolean, t: TranslateFunction, entries_per_page: number}) {
  const _entries = new Map<string, ExpandedEntry>()
  const entries = writable(_entries);

  const load_entries_locally = browser && (is_admin || firebaseConfig.projectId === 'talking-dictionaries-dev')
  if (!load_entries_locally)
    return { entries };

  function add(db_entries: ActualDatabaseEntry[]) {
    for (const entry of db_entries) {
      const expanded = convert_and_expand_entry(entry, t)
      _entries.set(entry.id, expanded)
    }
    entries.set(_entries)
    console.info({ added_entries: db_entries.length, total_entries: _entries.size })
  }

  const status = writable('initing');

  async function incrementally_get_entries() {
    const path = `dictionaries/${dictionary.id}/words`
    const order_by_lexeme = orderBy('lx', 'desc');

    // first get as many documents from cache as exist
    const { data: from_cache, ref, error } = await getCollectionOrError<ActualDatabaseEntry>(path, [order_by_lexeme], { fromCache: true })
    if (error) {
      status.set(`Error getting initial cache: ${error.message}`)
      return { status }
    }
    if (from_cache) {
      add(from_cache)
      if (from_cache.length > 100 || from_cache.length > (dictionary.entryCount * .9)) {
        create_index(_entries).then(() => {
          status.set('Cache search index created');
        })
      }
      status.set(`Entries loaded: initial cache check found ${from_cache.length}`)
    }

    // then get all entries from the server starting with the first page size and then growing in bigger steps (this will also update the cache to the current moment)
    async function get_page_from_server(page_size: number, start_at_lexeme?: string) {
      const queryConstraints: QueryConstraint[] = [limit(page_size), order_by_lexeme]
      if (start_at_lexeme)
        queryConstraints.push(startAt(start_at_lexeme)) // https://firebase.google.com/docs/firestore/query-data/query-cursors#paginate_a_query

      const { data: page_from_server, error } = await getCollectionOrError<ActualDatabaseEntry>(ref, queryConstraints);
      if (error)
        status.set(`Error fetching collection from server: ${error.message}`)
      if (start_at_lexeme ? page_from_server?.length > 1 : page_from_server?.length) {
        add(page_from_server)
        status.set(`Entries loaded: went to server to fill page (${page_size}) and received ${page_from_server.length}`);
        const last_received_lexeme = page_from_server[page_from_server.length - 1].lx
        const additional_step_size = 100
        await get_page_from_server(additional_step_size, last_received_lexeme) // recursively repeat until all pages loaded
      } else {
        status.set(`Creating index ${_entries.size} entries`);
        await create_index(_entries)
        status.set('Search index created');
      }
    }
    await get_page_from_server(entries_per_page)
  }
  incrementally_get_entries()

  return { entries, status, search_entries }
}

