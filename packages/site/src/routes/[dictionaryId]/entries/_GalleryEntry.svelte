<script lang="ts">
  import type { IEntry } from '$lib/interfaces';
  import Image from '$lib/components/image/Image.svelte';
  export let entry: IEntry;
  export let canEdit = false;
  import { dictionary } from '$lib/stores';
</script>

<div class="flex flex-col relative rounded max-w-[500px]">
  <div class="bg-gray-300 shadow">
    <div class="aspect-square overflow-hidden">
      <Image square={480} {entry} {canEdit} />
    </div>
    <div class="card-content-wrapper">
      <p class="font-semibold absolute top-0 left-0">
        {@html entry._highlightResult ? entry._highlightResult.lx.value : entry.lx}
      </p>
      <!--Simple solution until we really work on implementing this feature-->
      {#if $dictionary.id === 'iquito' || $dictionary.id === 'muniche'}
        <p class="absolute bottom-0 left-0 text-xs">
          {@html entry._highlightResult
            ? entry._highlightResult.gl.es.value
            : entry.gl && entry.gl.es
            ? entry.gl.es
            : ''}
        </p>
      {:else}
        <p class="absolute bottom-0 left-0 text-xs">
          {@html entry._highlightResult
            ? entry._highlightResult.gl.en.value
            : entry.gl && entry.gl.en
            ? entry.gl.en
            : ''}
        </p>
      {/if}
    </div>
  </div>
</div>

<style>
  .card-content-wrapper {
    background: #f3f3f3;
    padding: 10px;
  }

  .card-content-wrapper > p {
    position: relative;
  }
</style>
