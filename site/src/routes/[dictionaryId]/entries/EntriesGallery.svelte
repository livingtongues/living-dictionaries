<script lang="ts">
  import type { EntryData, Tables } from '@living-dictionaries/types'
  import GalleryEntry from './gallery/GalleryEntry.svelte'

  export let entries: EntryData[] = []
  export let dictionary: Tables<'dictionaries'>
  export let can_edit = false
</script>

<div class="gallery">
  {#each entries as entry (entry.id)}
    <GalleryEntry {dictionary} {entry} {can_edit} />
  {/each}
</div>

<style>
  .gallery {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    grid-auto-rows: 1fr;
  }
</style>
