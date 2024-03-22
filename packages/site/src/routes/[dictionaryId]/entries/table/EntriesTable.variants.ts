import type { Variant, Viewport } from 'kitbook';
import type Component from './EntriesTable.svelte';
import { complex, simple, hasVideo } from '$lib/mocks/entries';
import { defaultColumns } from '$lib/stores/columns';
import { setUpColumns } from './setUpColumns';
import { basic_mock_dictionary } from '$lib/mocks/dictionaries';

const columns = setUpColumns(defaultColumns, basic_mock_dictionary);

export const viewports: Viewport[] = [
  {width: 4500, height: 500},
]

export const variants: Variant<Component>[] = [
  {
    props: {
      columns,
      entries: [complex, simple, hasVideo],
      can_edit: true,
      dictionaryId: basic_mock_dictionary.id,
    }
  }
]

