<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');
  import { addDictionaryManagePermission } from '$lib/helpers/dictionariesManaging';
  import type { IDictionary, IUser } from '$lib/interfaces';
  import Button from '$svelteui/ui/Button.svelte';
  import { Collection } from '$sveltefirets';

  export let user: IUser;

  let dictionariesType: IDictionary[];
  let dictionaryIds = [];
  let dictionaryID = '';

  async function save(id) {
    if (dictionaryIds.includes(id)) {
      try {
        addDictionaryManagePermission(user, id);
        close();
      } catch (err) {
        alert(`Error: ${err}`);
      }
    } else {
      alert('Dictionary ID not found');
    }
  }
</script>

<Collection
  path="dictionaries"
  startWith={dictionariesType}
  on:data={(e) => {
    dictionaryIds = e.detail.data.map((d) => d.id);
  }} />

<Modal on:close>
  <span slot="heading">
    Select Dictionary ID to let {user.displayName} manage
  </span>

  {#if dictionaryIds.length}
    <input type="text" bind:value={dictionaryID} list="ids" placeholder="Search by ID" />
    <datalist id="ids">
      {#each dictionaryIds as id}
        <option>{id}</option>
      {/each}
    </datalist>
  {:else}Loading dictionaries...{/if}

  <div class="modal-footer space-x-1">
    <Button onclick={close} color="black">Cancel</Button>
    <Button onclick={() => save(dictionaryID)} color="green" form="primary">Save</Button>
  </div>
</Modal>

<style>
  input {
    @apply w-full px-3 py-2 border border-gray-300
      rounded placeholder-gray-500 focus:outline-none
      focus:ring-primary-300 focus:border-primary-300;
  }
</style>
