import { redirect, error } from '@sveltejs/kit';
import type { IDictionary, ExpandedEntry, ActualDatabaseEntry } from '@living-dictionaries/types';
import { collectionStore, getDocument, getCollection, docStore, docExists } from 'sveltefirets';
import type { LayoutLoad } from './$types';
import { ResponseCodes } from '$lib/constants';
import { writable, type Readable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { limit } from 'firebase/firestore';
import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
import type { TranslateFunction } from '$lib/i18n/types';
import { tick } from 'svelte';
import { create, insertMultiple, search, type Orama, type SearchParams } from '@orama/orama'

export const load: LayoutLoad = async ({ params: { dictionaryId }, parent }) => {
  try {
    const dictionary_document = await getDocument<IDictionary>(`dictionaries/${dictionaryId}`);
    const dictionary = docStore(`dictionaries/${dictionaryId}`, { startWith: dictionary_document });

    const { t, user } = await parent();

    const is_manager: Readable<boolean> = derived(
      [user, dictionary],
      ([$user, $dictionary], set) => {
        if ($user) {
          if ($user?.roles?.admin > 0) {
            set(true);
          } else {
            docExists(`dictionaries/${$dictionary.id}/managers/${$user.uid}`)
              .then((exists) => set(exists))
              .catch((err) => {
                console.error('Manager checking error: ', err);
              });
          }
        } else {
          set(false);
        }
      }
    );

    const is_contributor: Readable<boolean> = derived(
      [user, dictionary],
      ([$user, $dictionary], set) => {
        if ($user) {
          docExists(`dictionaries/${$dictionary.id}/contributors/${$user.uid}`)
            .then((exists) => set(exists))
            .catch((err) => {
              console.error('Contributor checking error: ', err);
            });
        } else {
          set(false);
        }
      }
    );

    const can_edit: Readable<boolean> = derived(
      [is_manager, is_contributor],
      ([$isManager, $isContributor]) => $isManager || $isContributor
    );

    const entries_per_page = 20
    const entries = create_entries_store(dictionaryId, t, entries_per_page);

    if (dictionary_document)
      return { dictionary, entries, entries_per_page, is_manager, is_contributor, can_edit };
  } catch (err) {
    // only thrown if there was a db error
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err);
  }
  // reaches here if no dictionary
  redirect(ResponseCodes.MOVED_PERMANENTLY, '/');
};

function create_entries_store(dictionaryId: string, t: TranslateFunction, entries_per_page: number) {
  if (!browser) { // TODO: use admin check
    const { subscribe } = writable<ExpandedEntry[]>(null);
    return { subscribe };
  }

  const { subscribe, set } = writable<ExpandedEntry[]>(null, start);

  function start() {
    console.info('creating entries store')
    let teardown: () => void;

    async function listen_to_entries() {
      const firebase_entries_first_set = await getCollection<ActualDatabaseEntry>(`dictionaries/${dictionaryId}/words`, [limit(entries_per_page)]);
      const expanded_entries = firebase_entries_first_set.map(entry => convert_and_expand_entry(entry, t));
      set(expanded_entries)
      console.info({ first_set: expanded_entries.length })

      await tick()
      const entries = collectionStore<ActualDatabaseEntry>(`dictionaries/${dictionaryId}/words`, [], { startWith: firebase_entries_first_set });
      teardown = entries.subscribe(firebase_entries => {
        if (firebase_entries !== firebase_entries_first_set) {
          const expanded_entries = firebase_entries.map(entry => convert_and_expand_entry(entry, t));
          set_entries_and_create_index(expanded_entries)
          console.info({ all_entries: expanded_entries.length })
        }
      });
    }
    listen_to_entries();

    return () => teardown?.();
  }

  const entries_index_schema = {
    lexeme: 'string',
  } as const

  let orama_index: Orama<typeof entries_index_schema>

  async function set_entries_and_create_index(entries: ExpandedEntry[]) {
    set(entries);

    console.time('Index Entries Time');

    const new_index = await create({
      schema: entries_index_schema
    })

    await insertMultiple(new_index, entries)
    orama_index = new_index

    console.timeEnd('Index Entries Time');
  }

  function get_index(): Promise<typeof orama_index> {
    return new Promise(resolve => {
      if (orama_index) return resolve(orama_index)

      const interval = setInterval(() => {
        if (orama_index) {
          clearInterval(interval)
          resolve(orama_index)
        }
      }, 25)
    })
  }

  // export type EntryDocument = TypedDocument<Orama<typeof entries_index_schema>>

  async function search_entries(query: string, page_index: number) {
    console.info('searching for', query)
    const index = await get_index()
    const searchParams: SearchParams<Orama<typeof entries_index_schema>> = {
      term: query,
      limit: entries_per_page,
      offset: page_index * entries_per_page,
    }
    return await search(index, searchParams)
  }

  return { subscribe, search: search_entries }
}
