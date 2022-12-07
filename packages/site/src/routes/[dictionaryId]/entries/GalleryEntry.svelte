<script lang="ts">
  import { t } from 'svelte-i18n';
  import type { IEntry } from '@living-dictionaries/types';
  import { Image } from '@living-dictionaries/parts';
  export let entry: IEntry;
  export let canEdit = false;
  import { dictionary } from '$lib/stores';
  import { deleteImage } from '$lib/helpers/delete';
</script>

<div class="flex flex-col relative rounded max-w-[500px]">
  <div class="bg-gray-300 shadow">
    <div class="aspect-square overflow-hidden">
      <Image
        {t}
        square={480}
        lexeme={entry.lx}
        gcs={entry.pf.gcs}
        {canEdit}
        on:delete={() => deleteImage(entry)} />
    </div>
    <a data-sveltekit-prefetch href={entry.id}>
      <div class="card-content-wrapper">
        <p class="font-semibold absolute top-0 left-0">
          {@html entry._highlightResult ? entry._highlightResult?.lx?.value : entry.lx}
        </p>
        <!--Simple solution until we really work on implementing this feature-->
        {#if $dictionary.id === 'iquito' || $dictionary.id === 'muniche'}
          <p class="absolute bottom-0 left-0 text-xs">
            {@html entry._highlightResult
              ? entry._highlightResult?.gl?.es?.value
              : entry.gl && entry.gl.es
              ? entry.gl.es
              : ''}
          </p>
        {:else}
          <p class="absolute bottom-0 left-0 text-xs">
            {@html entry._highlightResult
              ? entry._highlightResult?.gl?.en?.value
              : entry.gl && entry.gl.en
              ? entry.gl.en
              : ''}
          </p>
        {/if}
      </div>
    </a>
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
