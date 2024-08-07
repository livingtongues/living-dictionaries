<script lang="ts">
  import { page } from '$app/stores';
  import { StandardPrintFields, type ExpandedEntry, type IPrintFields } from '@living-dictionaries/types';
  import type { createPersistedStore } from 'svelte-pieces';

  export let entries: ExpandedEntry[];
  export let preferredPrintFields: ReturnType<typeof createPersistedStore<IPrintFields>>;
  export let showLabels: ReturnType<typeof createPersistedStore<boolean>>;
  export let showQrCode: ReturnType<typeof createPersistedStore<boolean>>;

  $: fieldsThatExist = (Object.keys($preferredPrintFields) as (keyof IPrintFields)[]).filter((field) => {
    if (field === 'gloss') return true;
    return entries.find((entry) => {
      if (field === 'parts_of_speech') return entry.senses?.[0].parts_of_speech_keys?.length;
      if (field === 'local_orthography')
        return entry.local_orthography_1 || entry.local_orthography_2 || entry.local_orthography_3 || entry.local_orthography_4 || entry.local_orthography_5;
      if (field === 'example_sentence') return entry.senses?.[0].example_sentences?.length;
      if (field === 'semantic_domains') return entry.senses?.[0].ld_semantic_domains_keys?.length;
      if (field === 'noun_class') return entry.senses?.[0].noun_class;
      if (field === 'photo') return entry.senses?.[0].photo_files?.length;
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
    <label class="ml-1 text-sm text-gray-700" for={field}>{$page.data.t(`entry_field.${field}`)}</label>
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
