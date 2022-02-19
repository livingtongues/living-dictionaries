<script lang="ts">
  import BadgeArrayEmit from '$svelteui/data/BadgeArrayEmit.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import {
    removeDictionaryManager,
    removeDictionaryContributorPermission,
    removeDictionaryCollaboratorPermission,
  } from '$lib/helpers/dictionariesManaging';
  import { addOnline } from '$sveltefirets';
  import type { IHelper } from '$lib/interfaces';

  export let helpers: IHelper[] = [];
  export let dictionaryId: string;
  export let role: 'manager' | 'contributor' | 'writeInCollaborator';

  async function remove(
    helper: IHelper,
    dictionaryId: string,
    role: 'manager' | 'contributor' | 'writeInCollaborator'
  ) {
    try {
      if (role === 'manager') {
        removeDictionaryManager(helper, dictionaryId);
      }
      if (role === 'writeInCollaborator') {
        removeDictionaryCollaboratorPermission(helper, dictionaryId);
      }
      if (role === 'contributor') {
        removeDictionaryContributorPermission(helper, dictionaryId);
      }
    } catch (err) {
      alert(`Error: ${err}`);
    }
  }

  async function addWriteInCollaborator() {
    const name = prompt('Name?');
    if (name) {
      addOnline(`dictionaries/${dictionaryId}/writeInCollaborators`, { name });
    }
  }
</script>

<div class="py-3">
  <div class="text-sm leading-5 font-medium text-gray-900">
    <ShowHide let:show let:toggle={toggleSelectUserModal}>
      <BadgeArrayEmit
        strings={helpers.map((h) => h.name)}
        canEdit
        addMessage="Add"
        on:itemremoved={(e) => remove(helpers[e.detail.index], dictionaryId, role)}
        on:additem={role === 'writeInCollaborator'
          ? addWriteInCollaborator
          : toggleSelectUserModal} />

      <button>Invite button here</button>

      {#if show && role !== 'writeInCollaborator'}
        {#await import('./_SelectUserModal.svelte') then { default: SelectUserModal }}
          <SelectUserModal {dictionaryId} {role} on:close={toggleSelectUserModal} />
        {/await}
      {/if}
    </ShowHide>
  </div>
</div>
