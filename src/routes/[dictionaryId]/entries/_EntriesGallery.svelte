<script lang="ts">
  import type { IEntry } from '$lib/interfaces';
  export let entries: IEntry[] = [];
  import Image from '$lib/components/image/Image.svelte';
  import { canEdit } from '$lib/stores';
</script>

<div class="grid">
  {#each entries as entry (entry.id)}
    {#if entry.pf}
      <div
        class="bg-gray-300 shadow relative rounded overflow-hidden"
        style="max-width: 500px; max-height: 500px;">
        <Image square={480} {entry} canEdit={$canEdit} />
        <div
          class="text-dark-shadow text-white font-semibold p-2 absolute top-0
            left-0">
          {@html entry._highlightResult ? entry._highlightResult.lx.value : entry.lx}
        </div>
        <div
          class="text-dark-shadow text-white p-2 absolute bottom-0 left-0
            text-xs">
          {@html entry._highlightResult
            ? entry._highlightResult.gl.en.value
            : entry.gl && entry.gl.en
            ? entry.gl.en
            : ''}
        </div>
      </div>
    {/if}
  {/each}
</div>

<!-- Talking Dictionaries v1 example: http://talkingdictionary.swarthmore.edu/kapingamarangi/?images&gallery&page=1 -->
<style>
  :global(mark) {
    color: yellow;
    background: rgba(0, 0, 0, 1);
  }

  .grid {
    display: grid;
    gap: 0.5rem;

    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    grid-auto-rows: 1fr;
  }
</style>
