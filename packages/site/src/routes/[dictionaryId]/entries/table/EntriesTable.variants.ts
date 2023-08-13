import type { Variants } from 'kitbook';
import type Component from './EntriesTable.svelte';
import { mock_expanded_entries } from '$lib/mocks/entries';
import type { IColumn } from '@living-dictionaries/types';
// import { setUpColumns } from './setUpColumns';

const column: IColumn = {
  field: 'lx',
  width: 300,
  display: 'The lexeme',
}

// const columns = setUpColumns($preferredColumns, $dictionary);

export const variants: Variants<Component> = mock_expanded_entries.map(variant => {
  return {
    name: variant.name,
    // height: 400,
    props: {
      column,
      entry: variant.entry,
      canEdit: true,
    }
  };
});
