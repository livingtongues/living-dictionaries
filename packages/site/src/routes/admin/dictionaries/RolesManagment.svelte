<script lang="ts">
  import { BadgeArrayEmit, ShowHide } from 'svelte-pieces';
  import {
    removeDictionaryCollaborator,
    removeDictionaryContributor,
    removeDictionaryManager,
  } from '$lib/helpers/dictionariesManaging';
  import { addOnline } from 'sveltefirets';
  import type { HelperRoles, IDictionary, IHelper } from '@living-dictionaries/types';

  export let helpers: IHelper[] = [];
  export let dictionary: IDictionary;
  export let role: HelperRoles;

  async function remove(helper: IHelper, dictionaryId: string, role: HelperRoles) {
    try {
      if (role === 'manager') 
        await removeDictionaryManager(helper, dictionaryId);
      
      if (role === 'writeInCollaborator') 
        await removeDictionaryCollaborator(helper, dictionaryId);
      
      if (role === 'contributor') 
        await removeDictionaryContributor(helper, dictionaryId);
      
    } catch (err) {
      alert(`Error: ${err}`);
    }
  }

  async function addWriteInCollaborator() {
    const name = prompt('Name?');
    if (name) 
      await addOnline(`dictionaries/${dictionary.id}/writeInCollaborators`, { name });
    
  }
</script>

<ShowHide let:show let:toggle={toggleSelectUserModal}>
  <BadgeArrayEmit
    strings={helpers.map((h) => h.name)}
    canEdit
    addMessage="Add"
    on:itemclicked={(e) => alert(helpers[e.detail.index].id)}
    on:itemremoved={async (e) => await remove(helpers[e.detail.index], dictionary.id, role)}
    on:additem={role === 'writeInCollaborator' ? addWriteInCollaborator : toggleSelectUserModal} />

  {#if show && role !== 'writeInCollaborator'}
    {#await import('../users/SelectUserModal.svelte') then { default: SelectUserModal }}
      <SelectUserModal {dictionary} {role} on:close={toggleSelectUserModal} />
    {/await}
  {/if}
</ShowHide>
