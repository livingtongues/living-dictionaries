<script lang="ts">
  import { Story } from "kitbook";
  import { ReactiveSet } from 'svelte-pieces';
  import type { IDictionary } from '@living-dictionaries/types';
  import DeleteDictionary from './DeleteDictionary.svelte';
  const foo_dictionary: IDictionary = {
    id: 'foo',
    name: 'Foo',
    glossLanguages: ['en'],
  }
</script>

# Delete Dictionary

<Story name="Dictionary without entryCount">
  <DeleteDictionary dictionary={foo_dictionary} />
</Story>

<Story name="Dictionary with 0 entryCount">
  <DeleteDictionary dictionary={foo_dictionary} />
</Story>

<Story name="Dictionary with 1 entryCount">
  <DeleteDictionary dictionary={{...foo_dictionary, entryCount: 1}} />
</Story>