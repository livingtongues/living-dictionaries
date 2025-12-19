<script lang="ts">
  import type { EntryData, Tables } from '@living-dictionaries/types'
  import GalleryEntry from './gallery/GalleryEntry.svelte'

  interface Props {
    entries?: EntryData[];
    dictionary: Tables<'dictionaries'>;
    can_edit?: boolean;
  }

  let { entries = [], dictionary, can_edit = false }: Props = $props();
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
