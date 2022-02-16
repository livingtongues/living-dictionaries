<script lang="ts">
  import { _ } from 'svelte-i18n';
  import BadgeArrayEmit from '$svelteui/data/BadgeArrayEmit.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import {
    removeDictionaryManagerPermission,
    removeDictionaryContributorPermission,
    removeDictionaryCollaboratorPermission,
  } from '$lib/helpers/dictionariesManaging';
  import { fetchUser } from '$lib/helpers/fetchUser';
  import { addOnline } from '$sveltefirets';
  export let data: any;
  export let dictionary: string;
  export let userRole: string;
  let data_strings: string[];
  $: data_strings = data.map((e) => e.name);
  async function remove(id: string, dictionary: string, role: string) {
    try {
      if (role === 'manager') {
        const user = await fetchUser(id);
        removeDictionaryManagerPermission(user, dictionary);
      }
      if (role === 'collab') {
        removeDictionaryCollaboratorPermission(id, dictionary);
      }
      if (role === 'contributor') {
        removeDictionaryContributorPermission(id, dictionary);
      }
    } catch (err) {
      alert(`Error: ${err}`);
    }
  }

  async function save() {
    const name = prompt(`${$_('speakers.name', { default: 'Name' })}?`);
    if (name) {
      addOnline(`dictionaries/${dictionary}/writeInCollaborators`, { name });
    }
  }
</script>

<div class="py-3">
  <div class="text-sm leading-5 font-medium text-gray-900">
    <ShowHide let:show let:toggle>
      <BadgeArrayEmit
        strings={data_strings}
        canEdit
        addMessage="Add"
        on:itemclicked={(e) => console.log('clicked:', data[e.detail.index].id)}
        on:itemremoved={(e) => remove(data[e.detail.index].id, dictionary, userRole)}
        on:additem={userRole === 'collab' ? save : toggle} />
      <button>Invite button here</button>
      {#if show}
        {#await import('./_SelectUserModal.svelte') then { default: SelectUserModal }}
          <SelectUserModal dictionaryID={dictionary} {userRole} on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  </div>
  <!-- <div class="text-sm leading-5 text-gray-500" /> -->
</div>
