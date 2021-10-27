<script lang="ts">
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { dictionary } from '$lib/stores';
  import Button from '$svelteui/ui/Button.svelte';
  import { downloadEntries } from './export/_entries';
  import type { IEntry } from '$lib/interfaces';
  import { getCollection } from '$sveltefire/firestore';

  let downloadData = true;
  $: dataType = downloadData ? 'CSV' : '';
  let downloadImages = false;
  let downloadAudio = false;

  let entries: IEntry[] = [];
  let mounted = false;

  onMount(async () => {
    entries = await getCollection<IEntry>(`dictionaries/${$dictionary.id}/words`);
    mounted = true;
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

<h3 class="text-xl font-semibold">{$_('misc.export', { default: 'export' })}</h3>

<h3 class="font-semibold text-lg mt-3">Options</h3>

<div class="items-center mt-2 mb-6 ml-3">
  <input disabled id="data" type="checkbox" bind:checked={downloadData} class="opacity-50" />
  <label for="data" class="mx-2 block leading-5 text-gray-900"> Data </label>
  <div
    class={`ml-8 mt-2 py-2 px-4 opacity-50 ${downloadData ? '' : 'opacity-50 cursor-not-allowed'}`}>
    <label class="inline-flex items-center">
      <input
        disabled={!downloadData}
        type="radio"
        class="form-radio"
        name="accountType"
        bind:group={dataType}
        value={'CSV'} />
      <span class="ml-2">CSV</span>
    </label>
    <!--TODO xlsx option-->
    <!-- <label class="inline-flex items-center ml-6">
      <input
        disabled={!data}
        type="radio"
        class="form-radio"
        name="accountType"
        bind:group={dataType}
        value={'xlxs'} />
      <span class="ml-2">xlsx</span>
    </label> -->
  </div>
  <div>
    <div class={`${hasImages ? '' : 'opacity-50 cursor-not-allowed'}`}>
      <input disabled={!hasImages} id="images" type="checkbox" bind:checked={downloadImages} />
      <label for="images" class="mx-2 block leading-5 text-gray-900"> Images </label>
    </div>
    {#if mounted}
      <p class="text-xs italic text-orange-400 p-2">Checking if images are available</p>
    {:else if !hasImages}
      <p class="text-sm text-red-700 p-3">There are no images</p>
    {/if}
  </div>
  <div>
    <div class={`${hasAudio ? '' : 'opacity-50 cursor-not-allowed'}`}>
      <input id="audio" type="checkbox" bind:checked={downloadAudio} />
      <label for="audio" class="mx-2 block leading-5 text-gray-900"> Audio </label>
    </div>
    {#if mounted}
      <p class="text-xs italic text-orange-400 p-2">Checking if audio is available</p>
    {:else if !hasAudio}
      <p class="text-sm text-red-700 p-3">There are no audio files</p>
    {/if}
  </div>
</div>

{#if downloadImages && downloadAudio}
  <Button
    onclick={async () =>
      await downloadEntries(
        $dictionary.id,
        $dictionary.name,
        $dictionary.glossLanguages,
        true,
        true
      )}
    form="primary">Download CSV & Audio & Images</Button>
{:else if downloadAudio && !downloadImages}
  <Button
    onclick={async () =>
      await downloadEntries($dictionary.id, $dictionary.name, $dictionary.glossLanguages, true)}
    form="primary">Download CSV & Audio</Button>
{:else if downloadImages && !downloadAudio}
  <Button
    onclick={async () =>
      await downloadEntries(
        $dictionary.id,
        $dictionary.name,
        $dictionary.glossLanguages,
        false,
        true
      )}
    form="primary">Download CSV & Images</Button>
{:else}
  <Button
    onclick={async () => {
      await downloadEntries($dictionary.id, $dictionary.name, $dictionary.glossLanguages);
    }}
    form="primary">Download CSV</Button>
{/if}
