<script lang="ts">
  import type { Readable } from 'svelte/store';
  import { _ } from 'svelte-i18n';
  import { StandardPrintFields, type IEntry, type IPrintFields } from '@living-dictionaries/types';

  export let entries: IEntry[];
  export let preferredPrintFields: Readable<IPrintFields>;
  export let showLabels: Readable<boolean>;
  export let showQrCode: Readable<boolean>;

  $: fieldsThatExist = Object.keys($preferredPrintFields).filter((field) => {
    if (field === 'gloss') return true;
    return entries.find((entry) => {
      if (field === 'alternateOrthographies')
        return entry.lo || entry.lo2 || entry.lo3 || entry.lo4 || entry.lo5;
      if (field === 'example_sentence') return entry.xv || entry.xs;
      if (field === 'sdn') return entry.sdn?.length || entry.sd;
      if (field === 'image') return entry.pf?.gcs;
      if (field === 'speaker') return entry.sf?.sp || entry.sf?.speakerName;
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
    >{$_(`entry.${field}`, { default: field })}</label>
  </div>
{/each}

{#if showingFieldsWithLabels}
  <div class="flex items-center mr-3 mb-1">
    <input id="showLabels" type="checkbox" bind:checked={$showLabels} />
    <label class="ml-1 text-sm text-gray-700" for="showLabels">{$_('print.labels', { default: 'Show Labels' })}</label>
  </div>
{/if}

<div class="flex items-center mr-3 mb-1">
  <input id="showLabels" type="checkbox" bind:checked={$showQrCode} />
  <label class="ml-1 text-sm text-gray-700" for="showLabels">{$_('print.qr_code', { default: 'Show QR Code' })}</label>
</div>
