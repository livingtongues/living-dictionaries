<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Button } from 'svelte-pieces';
  import type { IDictionary } from '@living-dictionaries/types';

  export let dictionary: IDictionary;

  function delete_dictionary_if_empty(dictionary: IDictionary) {
    if (dictionary.entryCount === 0) {
      const confirm = prompt('If you are sure about this, type the dictionary ID to confirm the complete deletion');
      if (confirm === dictionary.id) {
        alert('Deleted');
      } else {
        alert('Sorry the dictionary ID does not match what you typed');
      }
    } else {
      alert('You must delete every entry in the dictionary first');
    }
  }
</script>

<div>
  <Button
    color="red"
    form="simple"
    onclick={() => delete_dictionary_if_empty(dictionary)}>
    <span class="hidden md:inline">
      {$t('misc.delete', { default: 'Delete' })} {dictionary.name} {$t('misc.LD_singular', { default: 'Living Dictionary' })}
    </span>
    <i class="fas fa-trash ml-1" />
  </Button>
</div>