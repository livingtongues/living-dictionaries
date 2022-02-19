<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');
  import {
    addDictionaryManager,
    addDictionaryContributor,
  } from '$lib/helpers/dictionariesManaging';
  import type { IUser } from '$lib/interfaces';
  import Button from '$svelteui/ui/Button.svelte';
  import { Collection } from '$sveltefirets';
  import Filter from './_Filter.svelte';

  export let dictionaryId: string;
  export let role: 'manager' | 'contributor';

  let usersType: IUser[];

  async function add(user: IUser) {
    try {
      if (role === 'manager') {
        addDictionaryManager({ id: user.uid, name: user.displayName }, dictionaryId);
      }
      if (role === 'contributor') {
        addDictionaryContributor(user, dictionaryId);
      }
      close();
    } catch (err) {
      alert(`Error: ${err}`);
    }
  }
</script>

<Modal on:close>
  <span slot="heading"> Select a user to add {role} role to</span>
  <Collection path="users" startWith={usersType} let:data={users}>
    <Filter items={users} let:filteredItems={filteredUsers} placeholder="Search names and emails">
      {#each filteredUsers as user}
        <Button onclick={() => add(user)} color="green" form="primary">{user.displayName}</Button>
      {/each}

      <div class="modal-footer space-x-1">
        <Button onclick={close} color="black">Cancel</Button>
      </div>
    </Filter>
  </Collection>
</Modal>
