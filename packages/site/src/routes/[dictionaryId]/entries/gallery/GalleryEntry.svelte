<script lang="ts">
  import type { ExpandedEntry } from '@living-dictionaries/types';
  import Image from '$lib/components/image/Image.svelte';
  import { dictionary } from '$lib/stores';
  import { deleteImage } from '$lib/helpers/delete';

  export let entry: ExpandedEntry;
  export let canEdit = false;
</script>

<div class="flex flex-col relative rounded max-w-[500px]">
  <div class="bg-gray-300 shadow">
    <div class="aspect-square overflow-hidden">
      <Image
        square={480}
        title={entry.lexeme}
        gcs={entry.senses?.[0]?.photo_files?.[0].specifiable_image_url}
        {canEdit}
        on:deleteImage={() => deleteImage(entry, $dictionary.id)} />
    </div>
    <a href={entry.id} style="background: #f3f3f3;" class="block p-[10px]">
      <div class="font-semibold">
        {entry.lexeme}
      </div>
      <div class="text-xs">
        <!--Simple solution until we really work on implementing this feature-->
        {#if $dictionary.id === 'iquito' || $dictionary.id === 'muniche'}
          {entry.senses?.[0]?.glosses?.es || ''}
        {:else}
          {entry.senses?.[0]?.glosses?.en || ''}
        {/if}
      </div>
    </a>
  </div>
</div>
