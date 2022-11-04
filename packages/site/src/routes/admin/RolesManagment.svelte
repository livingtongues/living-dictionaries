<script lang="ts">
  import BadgeArrayEmit from 'svelte-pieces/data/BadgeArrayEmit.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import {
    removeDictionaryManager,
    removeDictionaryContributor,
    removeDictionaryCollaborator,
  } from '$lib/helpers/dictionariesManaging';
  import { addOnline } from 'sveltefirets';
  import type { HelperRoles, IDictionary, IHelper } from '@living-dictionaries/types';

  export let helpers: IHelper[] = [];
  export let dictionary: IDictionary;
  export let role: HelperRoles;

  async function remove(helper: IHelper, dictionaryId: string, role: HelperRoles) {
    try {
      if (role === 'manager') {
        removeDictionaryManager(helper, dictionaryId);
      }
      if (role === 'writeInCollaborator') {
        removeDictionaryCollaborator(helper, dictionaryId);
      }
      if (role === 'contributor') {
        removeDictionaryContributor(helper, dictionaryId);
      }
    } catch (err) {
      alert(`Error: ${err}`);
    }
  }

  async function addWriteInCollaborator() {
    const name = prompt('Name?');
    if (name) {
      addOnline(`dictionaries/${dictionary.id}/writeInCollaborators`, { name });
    }
  }
</script>

<ShowHide let:show let:toggle={toggleSelectUserModal}>
  <BadgeArrayEmit
    strings={helpers.map((h) => h.name)}
    canEdit
    addMessage="Add"
    on:itemclicked={(e) => alert(helpers[e.detail.index].id)}
    on:itemremoved={(e) => remove(helpers[e.detail.index], dictionary.id, role)}
    on:additem={role === 'writeInCollaborator' ? addWriteInCollaborator : toggleSelectUserModal} />

  {#if show && role !== 'writeInCollaborator'}
    {#await import('./SelectUserModal.svelte') then { default: SelectUserModal }}
      <SelectUserModal {dictionary} {role} on:close={toggleSelectUserModal} />
    {/await}
  {/if}
</ShowHide>
