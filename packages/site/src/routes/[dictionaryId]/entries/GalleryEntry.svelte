<script lang="ts">
  import type { IEntry } from '@living-dictionaries/types';
  import Image from '$lib/components/image/Image.svelte';
  export let entry: IEntry;
  export let canEdit = false;
  import { dictionary } from '$lib/stores';
  import { deleteImage } from '$lib/helpers/delete';
</script>

<div class="flex flex-col relative rounded max-w-[500px]">
  <div class="bg-gray-300 shadow">
    <div class="aspect-square overflow-hidden">
      <Image
        square={480}
        title={entry.lx}
        gcs={entry.pf.gcs}
        {canEdit}
        on:deleteImage={() => deleteImage(entry)} />
    </div>
    <a href={entry.id} style="background: #f3f3f3;" class="block p-[10px]">
      <div class="font-semibold">
        {@html entry._highlightResult?.lx?.value || entry.lx}
      </div>
      <div class="text-xs">
        <!--Simple solution until we really work on implementing this feature-->
        {#if $dictionary.id === 'iquito' || $dictionary.id === 'muniche'}
          {@html entry._highlightResult?.gl?.es?.value || entry.gl?.es || ''}
        {:else}
          {@html entry._highlightResult?.gl?.en?.value || entry.gl?.en || ''}
        {/if}
      </div>
    </a>
  </div>
</div>
