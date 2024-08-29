<script lang="ts">
  import type { ExpandedEntry, IDictionary } from '@living-dictionaries/types'
  import GalleryEntry from './gallery/GalleryEntry.svelte'
  import type { DbOperations } from '$lib/dbOperations'

  export let entries: ExpandedEntry[] = []
  export let dictionary: IDictionary
  export let can_edit = false
  export let deleteImage: DbOperations['deleteImage']
</script>

<div class="gallery">
  {#each entries as entry (entry.id)}
    <GalleryEntry {dictionary} {entry} {can_edit} {deleteImage} />
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
