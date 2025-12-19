<script lang="ts">
  import type { DictionaryView } from '@living-dictionaries/types'
  import { Button, Modal } from '$lib/svelte-pieces'
  import Filter from '$lib/components/Filter.svelte'

  interface Props {
    on_close: () => void;
    add_dictionary: (dictionary_id: string) => Promise<void>;
    dictionaries: DictionaryView[];
  }

  let { on_close, add_dictionary, dictionaries }: Props = $props();
</script>

<Modal {on_close}>
  {#snippet heading()}
    <span >
      Select Dictionary
    </span>
  {/snippet}
  <Filter
    items={dictionaries}
    
    placeholder="Search dictionaries">
    {#snippet children({ filteredItems: filteredDictionaries })}
        {#each filteredDictionaries as dictionary}
        <Button
          onclick={async () => {
            await add_dictionary(dictionary.id)
            on_close()
          }}
          color="green"
          form="simple"
          class="w-full !text-left">{dictionary.name} <small>({dictionary.id})</small></Button>
      {/each}

      <div class="modal-footer space-x-1">
        <Button onclick={on_close} color="black">Cancel</Button>
      </div>
          {/snippet}
    </Filter>
</Modal>
