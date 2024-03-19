import { redirect, error } from '@sveltejs/kit';
import type { IDictionary, ExpandedEntry, ActualDatabaseEntry } from '@living-dictionaries/types';
import { incrementalCollectionStore, getDocument, docStore, docExists } from 'sveltefirets';
import type { LayoutLoad } from './$types';
import { ResponseCodes } from '$lib/constants';
import { writable, type Readable, derived, type Unsubscriber } from 'svelte/store';
import { browser, dev } from '$app/environment';
import { limit } from 'firebase/firestore';
import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
import type { TranslateFunction } from '$lib/i18n/types';
import { create, insertMultiple, search, type Orama, type SearchParams as OramaSearchParams } from '@orama/orama'
import type { SearchParams } from './entries-local/+layout';

export const load: LayoutLoad = async ({ params: { dictionaryId }, parent }) => {
  try {
    const dictionary_document = await getDocument<IDictionary>(`dictionaries/${dictionaryId}`);
    const dictionary = docStore(`dictionaries/${dictionaryId}`, { startWith: dictionary_document });

    const { t, user, user_from_cookies } = await parent();

    const is_manager: Readable<boolean> = derived(
      [user, dictionary],
      ([$user, $dictionary], set) => {
        if (!$user) return set(false)
        if ($user.roles?.admin > 0) return set(true)

        docExists(`dictionaries/${$dictionary.id}/managers/${$user.uid}`)
          .then((exists) => set(exists))
          .catch((err) => {
            console.error('Manager checking error: ', err);
          });
      }
    );

    const is_contributor: Readable<boolean> = derived(
      [user, dictionary],
      ([$user, $dictionary], set) => {
        if (!$user) return set(false)
        docExists(`dictionaries/${$dictionary.id}/contributors/${$user.uid}`)
          .then((exists) => set(exists))
          .catch((err) => {
            console.error('Contributor checking error: ', err);
          });
      }
    );

    const can_edit: Readable<boolean> = derived([is_manager, is_contributor],
      ([$is_manager, $is_contributor]) => $is_manager || $is_contributor
    );

    const entries_per_page = 20
    const entries = create_entries_store({dictionary: dictionary_document, is_admin: !!user_from_cookies?.roles?.admin, t, entries_per_page});

    if (dictionary_document)
      return { dictionary, entries, entries_per_page, is_manager, is_contributor, can_edit };
  } catch (err) {
    // only thrown if there was a db error
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err);
  }
  // reaches here if no dictionary
  redirect(ResponseCodes.MOVED_PERMANENTLY, '/');
};

function create_entries_store({dictionary, is_admin, t, entries_per_page}: { dictionary: IDictionary, is_admin: boolean, t: TranslateFunction, entries_per_page: number}) {
  const load_entries_locally = browser && (is_admin || dev)
  if (!load_entries_locally) {
    const { subscribe } = writable<ExpandedEntry[]>(null);
    return { subscribe };
  }

  const { subscribe, update } = writable<ExpandedEntry[]>(null, start);

  function start() {
    let teardown: Unsubscriber;
    incrementalCollectionStore<ActualDatabaseEntry>(`dictionaries/${dictionary.id}/words`, { initialQueryConstraints: [limit(entries_per_page)]}).then(entries_store => {
      teardown = entries_store.subscribe(firebase_entries => {
        const expanded_entries = firebase_entries.map(entry => convert_and_expand_entry(entry, t));
        update((current) => {
          if (current || expanded_entries.length === dictionary.entryCount)
            // create index when there is a change in entries (more loaded in) indicated by a current value or if the first set of entries is all this dictionary has.
            create_index(expanded_entries)
          return expanded_entries // this update the entries store
        })
        console.info({ entries: expanded_entries.length })
      });
    })

    return () => teardown?.();
  }

  const entries_index_schema = {
    lexeme: 'string',
    notes: 'string',
    has_audio: 'boolean',
    has_image: 'boolean',
    has_video: 'boolean',
    // has_speaker: 'boolean',
  } as const

  let orama_index: Orama<typeof entries_index_schema>

  async function create_index(entries: ExpandedEntry[]) {
    console.time('Augment Entries Time');

    const entries_augmented_for_search = entries.map(entry => {
      return {
        ...entry,
        has_audio: !!entry.sound_files?.length,
        has_image: !!entry.senses[0]?.photo_files?.length,
        has_video: !!entry.senses[0]?.video_files?.length,
        // has_speaker: !!entry.sound_files,
      }
    })

    console.timeEnd('Augment Entries Time');
    console.time('Index Entries Time');

    const new_index = await create({
      schema: entries_index_schema
    })

    await insertMultiple(new_index, entries_augmented_for_search)
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
      }, 50)
    })
  }

  async function search_entries(query_params: SearchParams, page_index: number) {
    console.info('searching for', query_params.query)
    const index = await get_index()

    // const where: Partial<WhereCondition<typeof entries_index_schema>> = {}

    const orama_search_params: OramaSearchParams<Orama<typeof entries_index_schema>> = {
      term: query_params.query,
      limit: entries_per_page,
      offset: page_index * entries_per_page,
      boost: {
        lexeme: 2,
      },
      facets: {
        has_audio: {
          true: true,
          false: true,
        },
        has_image: {
          true: true,
          false: true,
        },
      },
      where: {
        ...query_params.has_image ? { has_image: true }: {},
        ...query_params.no_image ? { has_image: false }: {},
        ...query_params.has_audio ? { has_audio: true }: {},
        ...query_params.no_audio ? { has_audio: false }: {},
        ...query_params.has_video ? { has_video: true }: {},
        ...query_params.no_video ? { has_video: false }: {},
      },
      sortBy: {
        property: 'lexeme',
      },
      threshold: 0.7, // 0-1 (1 default = 100% of related matches will also be returned, 0 = 0% of non-exact matches will be returned)
    }

    return await search(index, orama_search_params)
  }

  return { subscribe, search: search_entries }
}
