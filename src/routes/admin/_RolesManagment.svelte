<script lang="ts">
  import BadgeArrayEmit from '$svelteui/data/BadgeArrayEmit.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import { removeDictionaryManagePermission } from '$lib/helpers/dictionariesManaging';
  export let data: any;
  export let dictionary: string;
  let data_strings: string[];
  $: data_strings = data.map((e) => e.name);
  async function remove(id, dictionary) {
    removeDictionaryManagePermission(id, dictionary);
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
        on:itemremoved={(e) => remove(data[e.detail.index].id, dictionary)}
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
