<script lang="ts">
  import type { Readable } from 'svelte/store';
  import { page } from '$app/stores';
  import { StandardPrintFields, type ExpandedEntry, type IPrintFields } from '@living-dictionaries/types';

  export let entries: ExpandedEntry[];
  export let preferredPrintFields: Readable<IPrintFields>;
  export let showLabels: Readable<boolean>;
  export let showQrCode: Readable<boolean>;

  $: fieldsThatExist = (Object.keys($preferredPrintFields) as (keyof IPrintFields)[]).filter((field) => {
    if (field === 'gloss') return true;
    return entries.find((entry) => {
      if (field === 'alternateOrthographies')
        return entry.local_orthography_1 || entry.local_orthography_2 || entry.local_orthography_3 || entry.local_orthography_4 || entry.local_orthography_5;
      if (field === 'example_sentence') return entry.senses?.[0].example_sentences?.length;
      if (field === 'sdn') return entry.senses?.[0].ld_semantic_domains_keys?.length;
      if (field === 'image') return entry.senses?.[0].photo_files?.length;
      if (field === 'speaker') return entry.sound_files?.[0].speakerName || entry.sound_files?.[0].speaker_ids?.length;
      return entry[field];
    });
  });
  $: activeFields = Object.keys($preferredPrintFields).filter(
    (field) => $preferredPrintFields[field]
  );
  $: showingFieldsWithLabels = activeFields.find((field) =>
    Object.keys(StandardPrintFields).includes(field)
  );
</script>

{#each fieldsThatExist as field}
  <div class="flex items-center mr-3 mb-1">
    <input id={field} type="checkbox" bind:checked={$preferredPrintFields[field]} />
    <label class="ml-1 text-sm text-gray-700" for={field}>{$page.data.t(`entry.${field}`, { fallback: field })}</label>
  </div>
{/each}

{#if showingFieldsWithLabels}
  <div class="flex items-center mr-3 mb-1">
    <input id="showLabels" type="checkbox" bind:checked={$showLabels} />
    <label class="ml-1 text-sm text-gray-700" for="showLabels">{$page.data.t('print.labels')}</label>
  </div>
{/if}

<div class="flex items-center mr-3 mb-1">
  <input id="showLabels" type="checkbox" bind:checked={$showQrCode} />
  <label class="ml-1 text-sm text-gray-700" for="showLabels">{$page.data.t('print.qr_code')}</label>
</div>
