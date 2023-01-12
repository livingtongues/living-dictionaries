<script lang="ts">
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');
  import {
    addDictionaryContributor,
    addDictionaryManager,
  } from '$lib/helpers/dictionariesManaging';
  import type { IDictionary, IUser } from '@living-dictionaries/types';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { Collection } from 'sveltefirets';
  import Filter from '$lib/components/Filter.svelte';

  export let user: IUser;
  export let role: 'manager' | 'contributor';

  let dictionariesType: IDictionary[];

  async function add(dictionaryId: string) {
    try {
      if (role === 'manager') {
        addDictionaryManager({ id: user.uid, name: user.displayName }, dictionaryId);
      } else {
        addDictionaryContributor({ id: user.uid, name: user.displayName }, dictionaryId);
      }
      close();
    } catch (err) {
      alert(`Error: ${err}`);
    }
  }
</script>

<Modal on:close>
  <span slot="heading">
    Select Dictionary to let {user.displayName} be a {role}
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
