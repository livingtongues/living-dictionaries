<script lang="ts">
  import { t } from 'svelte-i18n';
  import type { IEntry } from '@living-dictionaries/types';
  import Image from '$lib/components/image/Image.svelte';
  export let entry: IEntry;
  export let canEdit = false;
  import { dictionary } from '$lib/stores';
  import { deleteImage } from '$lib/helpers/delete';
  import { get_first_sorted_gloss_safely} from '$lib/helpers/glosses';
</script>

<div class="flex flex-col relative rounded max-w-[500px]">
  <div class="bg-gray-300 shadow">
    <div class="aspect-square overflow-hidden">
      <Image
        square={480}
        lexeme={entry.lx}
        gcs={entry.pf.gcs}
        {canEdit}
        on:delete={() => deleteImage(entry)} />
    </div>
    <a href={entry.id} style="background: #f3f3f3;" class="block p-[10px]">
      <div class="font-semibold">
        {@html entry._highlightResult?.lx?.value || entry.lx}
      </div>
      <div class="text-xs">
        {@html entry._highlightResult?.gl?.en?.value || get_first_sorted_gloss_safely({
          glosses: entry.gl,
          dictionary_gloss_languages: $dictionary.glossLanguages,
          $t,
        })}
      </div>
    </a>
  </div>
</div>
