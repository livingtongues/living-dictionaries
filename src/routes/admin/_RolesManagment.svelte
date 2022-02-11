<script lang="ts">
  import BadgeArrayEmit from '$svelteui/data/BadgeArrayEmit.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import {
    removeDictionaryManagePermission,
    removeDictionaryCollaboratorPermission,
  } from '$lib/helpers/dictionariesManaging';
  import { fetchUser } from '$lib/helpers/fetchUser';
  export let data: any;
  export let dictionary: string;
  export let userRole: string;
  let data_strings: string[];
  $: data_strings = data.map((e) => e.name);
  async function remove(id: string, dictionary: string, role: string) {
    //TODO test if exceptions exist. Is it possible a user doesn't exist?
    if (role === 'manager') {
      const user = await fetchUser(id);
      removeDictionaryManagePermission(user, dictionary);
    }
    if (role === 'collab') {
      removeDictionaryCollaboratorPermission(id, dictionary);
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
        on:additem={toggle}
      />
      {#if show}
        <!-- {#await import('./_SelectDictionaryModal.svelte') then { default: SelectDictionaryModal }}
          <SelectDictionaryModal {user} on:close={toggle} />
        {/await} -->good
      {/if}
    </ShowHide>
  </div>
  <!-- <div class="text-sm leading-5 text-gray-500" /> -->
</div>
