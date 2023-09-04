<script lang="ts">
  import type { Readable } from 'svelte/store';
  import { t } from 'svelte-i18n';
  import { StandardPrintFields, type ExpandedEntry, type IPrintFields } from '@living-dictionaries/types';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';

  export let entries: ExpandedEntry[];
  export let preferredPrintFields: Readable<IPrintFields>;
  export let showLabels: Readable<boolean>;
  export let showQrCode: Readable<boolean>;

  $: fieldsThatExist = Object.keys($preferredPrintFields).filter((field) => {
    return entries.find((entry) => {
      entry = convert_and_expand_entry(entry);
      if (field === 'gloss' && entry.senses?.[0].glosses) return true;
      if (field === 'alternateOrthographies' && entry.local_orthography_1 || entry.local_orthography_2 || entry.local_orthography_3 || entry.local_orthography_4 || entry.local_orthography_5)
        return true;
      if (field === 'example_sentence'&& entry.senses?.[0].example_sentences?.length) return true;
      if (field === 'sdn' && entry.senses?.[0].ld_semantic_domains_keys?.length) return true;
      if (field === 'image' && entry.senses?.[0].photo_files?.length) return true;
      if (field === 'speaker' && (entry.sound_files?.[0].speakerName || entry.sound_files?.[0].speaker_ids?.length)) return true;
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
    <label class="ml-1 text-sm text-gray-700" for={field}
    >{$t(`entry.${field}`, { default: field })}</label>
  </div>
{/each}

{#if showingFieldsWithLabels}
  <div class="flex items-center mr-3 mb-1">
    <input id="showLabels" type="checkbox" bind:checked={$showLabels} />
    <label class="ml-1 text-sm text-gray-700" for="showLabels">{$t('print.labels', { default: 'Show Labels' })}</label>
  </div>
{/if}

<div class="flex items-center mr-3 mb-1">
  <input id="showLabels" type="checkbox" bind:checked={$showQrCode} />
  <label class="ml-1 text-sm text-gray-700" for="showLabels">{$t('print.qr_code', { default: 'Show QR Code' })}</label>
</div>
