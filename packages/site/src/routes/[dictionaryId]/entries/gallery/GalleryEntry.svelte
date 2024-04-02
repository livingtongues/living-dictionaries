<script lang="ts">
  import type { ExpandedEntry, IDictionary } from '@living-dictionaries/types';
  import Image from '$lib/components/image/Image.svelte';
  import { order_glosses } from '$lib/helpers/glosses';
  import { page } from '$app/stores';
  import type { DbOperations } from '$lib/dbOperations';

  export let entry: ExpandedEntry;
  export let can_edit = false;
  export let dictionary: IDictionary;
  export let deleteImage: DbOperations['deleteImage']

  $: glosses = order_glosses({
    glosses: entry.senses?.[0]?.glosses,
    dictionary_gloss_languages: dictionary.glossLanguages,
    t: $page.data.t,
    label: true
  });
</script>

<div class="flex flex-col relative rounded max-w-[500px]">
  <div class="bg-gray-300 shadow">
    <div class="aspect-square overflow-hidden">
      <Image
        square={480}
        title={entry.lexeme}
        gcs={entry.senses?.[0]?.photo_files?.[0].specifiable_image_url}
        {can_edit}
        on:deleteImage={() => deleteImage(entry, dictionary.id)} />
    </div>
    <a href={entry.id} style="background: #f3f3f3;" class="block p-[10px] h-60px">
      <div class="font-semibold">
        {entry.lexeme}
      </div>
      <div class="text-xs line-clamp-1">
        {glosses[0] || ''}
      </div>
    </a>
  </div>
</div>
