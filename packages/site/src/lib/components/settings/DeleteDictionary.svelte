<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from 'svelte-pieces';
  import type { IDictionary } from '@living-dictionaries/types';
  import { getCollection } from 'sveltefirets';
  import { removeDictionary } from '$lib/helpers/dictionariesManaging';

  export let dictionary: IDictionary;

  async function delete_dictionary_if_empty(dictionary: IDictionary) {
    const warning_message = 'You must delete every entry in the dictionary first'
    if (!dictionary?.entryCount || dictionary?.entryCount < 1) {
      const words_collection = await getCollection(`dictionaries/${dictionary.id}/words`);
      if (words_collection.length === 0)
        await removeDictionary(dictionary);
      else
        alert(warning_message);

    } else {
      alert(warning_message);
    }
  }
</script>

<div>
  <Button
    color="red"
    form="simple"
    onclick={() => delete_dictionary_if_empty(dictionary)}>
    <span class="md:inline">
      {$page.data.t('misc.delete')}: {$page.data.t('dictionary.full_title', { values: { dictionary_name: dictionary.name }})}
    </span>
    <i class="fas fa-trash ml-1" />
  </Button>
</div>
