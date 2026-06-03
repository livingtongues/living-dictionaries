<script lang="ts">
  import type { DictionaryView } from '@living-dictionaries/types'
  import { Button, Modal } from 'svelte-pieces'
  import Filter from '$lib/components/Filter.svelte'

  export let on_close: () => void
  export let add_dictionary: (dictionary_id: string) => Promise<void>
  export let dictionaries: DictionaryView[]
</script>

<Modal on:close={on_close}>
  <span slot="heading">
    Select Dictionary
  </span>
  <Filter
    items={dictionaries}
    let:filteredItems={filteredDictionaries}
    placeholder="Search dictionaries">
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
  </Filter>
</Modal>
