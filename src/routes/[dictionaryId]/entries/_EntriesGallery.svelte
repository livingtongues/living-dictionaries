<script lang="ts">
  import type { IEntry } from '$lib/interfaces';
  export let entries: IEntry[] = [];
  import Image from '$lib/components/image/Image.svelte';
  import { isManager, isContributor } from '$lib/stores';
</script>

<div class="grid">
  {#each entries as entry (entry.id)}
    {#if entry.pf}
      <div
        class="bg-gray-300 shadow relative rounded overflow-hidden"
        style="max-width: 500px; max-height: 500px;">
        <Image square={480} {entry} editable={$isManager || $isContributor} />
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

  /* @media screen and (min-width: 600px) {
  .card-tall {
    grid-row: span 2 / auto;
  }

  .card-wide {
    grid-column: span 2 / auto;
  }
} */
  /* .grid::before {
    content: '';
    width: 0;
    padding-bottom: 100%;
    grid-row: 1 / 1;
    grid-column: 1 / 1;
  } */

  /* .grid > *:first-child {
    grid-row: 1 / 1;
    grid-column: 1 / 1;
  } */
  /* https://medium.com/cloudaper/how-to-create-a-flexible-square-grid-with-css-grid-layout-ea48baf038f3 */
</style>
