<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');
  import { addDictionaryManager } from '$lib/helpers/dictionariesManaging';
  import type { IDictionary, IUser } from '$lib/interfaces';
  import Button from '$svelteui/ui/Button.svelte';
  import { Collection } from '$sveltefirets';
  import Filter from './_Filter.svelte';

  export let user: IUser;

  let dictionariesType: IDictionary[];

  async function add(dictionaryId: string) {
    try {
      addDictionaryManager({ id: user.uid, name: user.displayName }, dictionaryId);
      close();
    } catch (err) {
      alert(`Error: ${err}`);
    }
  }
</script>

<Modal on:close>
  <span slot="heading">
    Select Dictionary to let {user.displayName} manage
  </span>
  <Collection path="dictionaries" startWith={dictionariesType} let:data={dictionaries}>
    <Filter
      items={dictionaries}
      let:filteredItems={filteredDictionaries}
      placeholder="Search dictionaries">
      {#each filteredDictionaries as dictionary}
        <Button
          onclick={() => add(dictionary.id)}
          color="green"
          form="simple"
          class="w-full !text-left">{dictionary.name} <small>({dictionary.id})</small></Button>
      {/each}

      <div class="modal-footer space-x-1">
        <Button onclick={close} color="black">Cancel</Button>
      </div>
    </Filter>
  </Collection>
</Modal>
