import type { Variants } from 'kitbook';
import type Component from './EntriesTable.svelte';
import { mock_expanded_entries } from '$lib/mocks/entries';
import { defaultColumns } from '$lib/stores/columns';
import { setUpColumns } from './setUpColumns';
import { basic_mock_dictionary } from '$lib/mocks/dictionaries';

const columns = setUpColumns(defaultColumns, basic_mock_dictionary);

export const variants: Variants<Component> = [
  {
    // name: variant.name,
    height: 600,
    props: {
      columns,
      entries: mock_expanded_entries.map(({entry}) => entry),
      canEdit: true,
    }
  }
]

