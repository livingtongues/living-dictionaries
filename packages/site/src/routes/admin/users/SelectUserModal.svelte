<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');
  import {
    addDictionaryContributor,
    addDictionaryManager,
  } from '$lib/helpers/dictionariesManaging';
  import type { IDictionary, IUser } from '@living-dictionaries/types';
  import { Button, Modal } from 'svelte-pieces';
  import { Collection } from 'sveltefirets';
  import Filter from '$lib/components/Filter.svelte';
  import { inviteHelper } from '$lib/helpers/inviteHelper';
  import { orderBy } from 'firebase/firestore';

  export let dictionary: IDictionary;
  export let role: 'manager' | 'contributor';

  let usersType: IUser[];

  async function add(user: IUser) {
    try {
      if (role === 'manager')
        await addDictionaryManager({ id: user.uid, name: user.displayName }, dictionary.id);

      if (role === 'contributor')
        await addDictionaryContributor({ id: user.uid, name: user.displayName }, dictionary.id);

      close();
    } catch (err) {
      alert(`Error: ${err}`);
    }
  }
</script>

<Modal on:close>
  <span slot="heading"> Select a user to add {role} role to</span>
  <Collection
    path="users"
    startWith={usersType}
    let:data={users}
    queryConstraints={[orderBy('displayName')]}>
    <Filter items={users} let:filteredItems={filteredUsers} placeholder="Search names and emails">
      {#each filteredUsers as user}
        <Button onclick={async () => await add(user)} color="green" form="simple" class="w-full !text-left"
        >{user.displayName} <small>({user.email})</small></Button>
      {:else}
        <Button size="sm" onclick={() => inviteHelper(role, dictionary)}>Invite New User</Button>
      {/each}

      <div class="modal-footer space-x-1">
        <Button onclick={close} color="black">Cancel</Button>
      </div>
    </Filter>
  </Collection>
</Modal>
