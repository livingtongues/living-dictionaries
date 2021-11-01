<script lang="ts">
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { dictionary } from '$lib/stores';
  import Button from '$svelteui/ui/Button.svelte';
  import { exportEntriesAsCSV } from './export/_entries';
  import type { IEntry } from '$lib/interfaces';
  import { getCollection } from '$sveltefire/firestore';
  let NProgress;
  onMount(async () => {
    NProgress = await import('nprogress');
  });
  // let downloadData = true;
  // $: dataType = downloadData ? 'CSV' : '';
  let includeImages = false;
  let includeAudio = false;

  let entries: IEntry[] = [];
  let entriesLoaded = false;

  onMount(async () => {
    entries = await getCollection<IEntry>(`dictionaries/${$dictionary.id}/words`);
    entriesLoaded = true;
  });

  $: hasImages = entries.find((entry) => entry.pf);
  $: hasAudio = entries.find((entry) => entry.sf);
</script>

<svelte:head>
  <title>
    {$dictionary.name}
    {$_('misc.export', { default: 'export' })}
  </title>
</svelte:head>

<h3 class="text-xl font-semibold mb-4">{$_('misc.export', { default: 'export' })}</h3>

<!-- <h3 class="font-semibold text-lg mt-3">Options</h3> -->

<div class="mb-6">
  <div>
    <i class="far fa-check" /> Data as CSV
  </div>
  <!--TODO xlsx option-->
  <!-- <div class="flex items-center">
    <input disabled id="data" type="checkbox" bind:checked={downloadData} class="opacity-50" />
    <label for="data" class="mx-2 block leading-5 text-gray-900"> Data </label>
  </div>
  <div
    class="ml-4 my-2 py-2 px-4 flex items-center {downloadData
      ? ''
      : 'opacity-50 cursor-not-allowed'}">
    <input disabled={!downloadData} type="radio" name="csv" bind:group={dataType} value={'CSV'} />
    <label for="csv" class="mx-2 block leading-5 text-gray-900"> CSV </label>
    <label class="inline-flex items-center ml-6">
      <input
        disabled={!data}
        type="radio"
        class="form-radio"
        name="accountType"
        bind:group={dataType}
        value={'xlxs'} />
      <span class="ml-2">xlsx</span>
    </label>
  </div>-->
  <div class="flex items-center mt-2 {hasImages ? '' : 'opacity-50 cursor-not-allowed'}">
    <input disabled={!hasImages} id="images" type="checkbox" bind:checked={includeImages} />
    <label for="images" class="mx-2 block leading-5 text-gray-900"> Images </label>
  </div>
  {#if !entriesLoaded}
    <p class="text-xs italic text-orange-400 p-2">Checking if image files exist</p>
  {:else if !hasImages}
    <p class="text-sm text-red-700 p-3">There are no image files</p>
  {/if}

  <div class="flex items-center mt-2 {hasAudio ? '' : 'opacity-50 cursor-not-allowed'}">
    <input id="audio" type="checkbox" bind:checked={includeAudio} />
    <label for="audio" class="mx-2 block leading-5 text-gray-900"> Audio </label>
  </div>
  {#if !entriesLoaded}
    <p class="text-xs italic text-orange-400 p-2">Checking if audio files exist</p>
  {:else if !hasAudio}
    <p class="text-sm text-red-700 p-3">There are no audio files</p>
  {/if}
</div>

<Button
  onclick={async () => {
    NProgress.start();
    await exportEntriesAsCSV(entries, $dictionary, { includeImages, includeAudio });
    NProgress.done();
  }}
  form="primary">
  Download CSV
  {#if includeImages}
    + Images
  {/if}
  {#if includeAudio}
    + Audio
  {/if}
</Button>
