<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IEntry, IPrintFields } from '@living-dictionaries/types';
  import type { Readable } from 'svelte/store';
  export let preferredPrintFields: Readable<IPrintFields>;
  export let entries: IEntry[];
  export let showLabels: Readable<boolean>;
  export let showQrCode: Readable<boolean>;

  $: fieldsThatExist = Object.keys($preferredPrintFields).filter((field) =>
    entries.find((entry) => entry[field])
  );
  $: activeFields = Object.keys($preferredPrintFields).filter(
    (field) => $preferredPrintFields[field]
  );
  $: showingFieldsWithLabels = activeFields.find((field) =>
    ['in', 'mr', 'nc', 'pl', 'va', 'di', 'nt', 'id'].includes(field)
  );
</script>

{#each fieldsThatExist as field}
  <div class="flex items-center mr-3 mb-1">
    <input id={field} type="checkbox" bind:checked={$preferredPrintFields[field]} />
    <label class="ml-1 text-sm text-gray-700" for={field}>{$_(`entry.${[field]}`)}</label>
  </div>
{/each}

{#if showingFieldsWithLabels}
  <div class="flex items-center mr-3 mb-1">
    <input id="showLabels" type="checkbox" bind:checked={$showLabels} />
    <label class="ml-1 text-sm text-gray-700" for="showLabels">Show Labels</label>
  </div>
  {/if}
  
  <div class="flex items-center mr-3 mb-1">
    <input id="showLabels" type="checkbox" bind:checked={$showQrCode} />
    <label class="ml-1 text-sm text-gray-700" for="showLabels">Show QR Code</label>
  </div>