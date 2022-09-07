<script lang="ts">
  import {onMount} from 'svelte';
  import { _ } from 'svelte-i18n';
  import { dictionary, isManager } from '$lib/stores';
  import { PrintLayout, dictionaryFields } from '@living-dictionaries/parts';
  import type { IEntry, ISpeaker } from '@living-dictionaries/types';
  import { getCollection } from 'sveltefirets';
  import { fetchSpeakers } from '$lib/helpers/fetchSpeakers';

  let speakers:ISpeaker[];
  let entries:IEntry[];
  onMount(async () => {
    entries = await getCollection<IEntry>(`dictionaries/${$dictionary.id}/words`);
    speakers = await fetchSpeakers(entries);
  });

  let fontSize = 1;
  let imageSize = 100;

  const selectedFields = {
    lo: true,
    lo2: true,
    lo3: true,
    lo4: true,
    lo5: true,
    ph: true,
    gl: true,
    ps: true,
    xv: true,
    xs: true,
    pf: true,
    sr: false,
    sd: false,
    id: false,
    in: false,
    mr: false,
    nc: false,
    pl: false,
    va: false,
    di: false,
    nt: false,
    sf: false,
    vfs: false,
    qr: false,
  };
</script>
<div class="mt-15">
  <h2 class="text-3xl font-semibold mb-4">Print View Preview</h2>
  <div class="mb-3">
    <label class="font-medium text-gray-700" for="fontSize">Font size</label>
    <input class="form-input w-12" id="fontSize" type="number" bind:value={fontSize} />
  </div>
  <div class="mb-3">
    <label class="font-medium text-gray-700" for="imageSize">Image Size</label>
    <input class="form-input w-17" id="imageSize" type="number" bind:value={imageSize} /><span class="font-medium text-gray-700">%</span>
  </div>
  <div>
    {#each Object.entries(selectedFields) as field}
      {' ⦿ '}
      <input id={field[0]} type="checkbox" bind:checked={selectedFields[field[0]]} />  
      <label class="text-sm font-medium text-gray-700" for={field[0]}>{dictionaryFields[field[0]]}</label>
    {/each}
  </div>
  {#if speakers}
    <PrintLayout {fontSize} {imageSize} {entries} {selectedFields} {speakers} dictionaryId={$dictionary.id} />
  {/if}
</div>