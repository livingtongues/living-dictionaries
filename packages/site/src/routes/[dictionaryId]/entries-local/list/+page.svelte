<script lang="ts">
  import ListEntry from '../../entries/list/ListEntry.svelte';

  export let data;
  $: ({entries, dictionary, entries_page_count} = data)
  $: entries_for_page = $entries?.slice(0, entries_page_count)
</script>

{#if entries_for_page}
  {#each entries_for_page as entry}
    <ListEntry
      {dictionary}
      {entry}
      videoAccess={dictionary.videoAccess}
      canEdit
      on:deleteImage={() => alert('delete image not implemented yet')} />
  {/each}
{:else}
  <p>Loading...</p>
{/if}
