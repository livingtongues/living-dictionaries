<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');
  import {
    addDictionaryManager,
    addDictionaryContributorPermission,
  } from '$lib/helpers/dictionariesManaging';
  import type { IUser } from '$lib/interfaces';
  import Button from '$svelteui/ui/Button.svelte';
  import Collection from '$sveltefire/components/Collection.svelte';

  export let dictionaryId: string;
  export let role: 'manager' | 'contributor';

  let usersType: IUser[];
  let userEmail = '';

  async function save(users: IUser[], email: string) {
    try {
      const user = users.find((user) => email === user.email);
      if (role === 'manager') {
        addDictionaryManager({ id: user.uid, name: user.displayName }, dictionaryId);
      }
      if (role === 'contributor') {
        addDictionaryContributorPermission(user, dictionaryId);
      }
      close();
    } catch (err) {
      alert(`Error: ${err}`);
    }
  }
</script>

<Collection path="users" startWith={usersType} let:data={users}>
  <Modal on:close>
    <span slot="heading"> Select User ID to let manage </span>

    {#if users.length}
      <input type="text" bind:value={userEmail} list="ids" placeholder="Search by ID" />
      <datalist id="ids">
        {#each users as user}
          <option>{user.email}</option>
        {/each}
      </datalist>
    {:else}Loading users...{/if}

    <div class="modal-footer space-x-1">
      <Button onclick={close} color="black">Cancel</Button>
      <Button onclick={() => save(users, userEmail)} color="green" form="primary">Save</Button>
    </div>
  </Modal>
</Collection>

<style>
  input {
    @apply w-full px-3 py-2 border border-gray-300
      rounded placeholder-gray-500 focus:outline-none
      focus:ring-primary-300 focus:border-primary-300;
  }
</style>
