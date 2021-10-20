<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { dictionary } from '$lib/stores';
  import Button from '$svelteui/ui/Button.svelte';
  import { downloadEntries, haveMediaFile } from './export/_fetchers';
  import { glossingLanguages } from '$lib/export/glossing-languages-temp';
  import About from '../about.svelte';

  let data = true;
  let dataType = '';
  let images = false;
  let audio = false;
  let loading = false;
  let havePhotoFile: boolean;
  let haveAudioFile: boolean;

  async function mediaAvailable() {
    const mediaResults = await haveMediaFile($dictionary.id);
    havePhotoFile = mediaResults.images;
    haveAudioFile = mediaResults.audio;
  }
  mediaAvailable();
  $: havePhotoFile;
  $: haveAudioFile;
  $: if (!data) {
    dataType = '';
  } else {
    dataType = 'CSV';
  }
</script>

<svelte:head>
  <title>
    {$dictionary.name}
    {$_('misc.export', { default: 'export' })}
  </title>
</svelte:head>

<h3 class="text-xl font-semibold">{$_('misc.export', { default: 'export' })}</h3>

<h3 class="font-semibold text-lg mt-3">
  <!-- {$_('dictionary.contributors', { default: 'Contributors' })} -->
  Options
</h3>

<div class="items-center mt-2 mb-6 ml-3">
  <input disabled id="public" type="checkbox" bind:checked={data} class="opacity-50" />
  <label for="public" class="mx-2 block leading-5 text-gray-900">
    <!-- {$_('create.visible_to_public', { default: 'Visible to Public' })} -->
    Data
  </label>
  <div class={`ml-8 mt-2 py-2 px-4 opacity-50 ${data ? '' : 'opacity-50 cursor-not-allowed'}`}>
    <label class="inline-flex items-center">
      <input
        disabled={!data}
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
    <div class={`${havePhotoFile ? '' : 'opacity-50 cursor-not-allowed'}`}>
      <input disabled={!havePhotoFile} id="public" type="checkbox" bind:checked={images} />
      <label for="public" class="mx-2 block leading-5 text-gray-900">
        <!-- {$_('create.visible_to_public', { default: 'Visible to Public' })} -->
        Images
      </label>
    </div>
    {#if typeof havePhotoFile !== 'boolean'}
      <p class="text-xs italic text-orange-400 p-2">Checking if images are available</p>
    {:else if havePhotoFile === false}
      <p class="text-sm text-red-700 p-3">There are no images</p>
    {/if}
  </div>
  <div>
    <div class={`${haveAudioFile ? '' : 'opacity-50 cursor-not-allowed'}`}>
      <input id="public" type="checkbox" bind:checked={audio} />
      <label for="public" class="mx-2 block leading-5 text-gray-900">
        <!-- {$_('create.visible_to_public', { default: 'Visible to Public' })} -->
        Audio
      </label>
    </div>
    {#if typeof haveAudioFile !== 'boolean'}
      <p class="text-xs italic text-orange-400 p-2">Checking if audio is available</p>
    {/if}
    {#if haveAudioFile === false}
      <p class="text-sm text-red-700 p-3">There is no audio</p>
    {/if}
  </div>
</div>

{#if !loading}
  {#if images && audio}
    <Button
      onclick={async () => {
        loading = true;
        await downloadEntries(
          $dictionary.id,
          $dictionary.name,
          $dictionary.glossLanguages,
          true,
          true
        );
        loading = false;
      }}
      form="primary">Download CSV & Audio & Images</Button>
  {:else if audio && !images}
    <Button
      onclick={async () => {
        loading = true;
        await downloadEntries($dictionary.id, $dictionary.name, $dictionary.glossLanguages, true);
        loading = false;
      }}
      form="primary">Download CSV & Audio</Button>
  {:else if images && !audio}
    <Button
      onclick={async () => {
        loading = true;
        await downloadEntries(
          $dictionary.id,
          $dictionary.name,
          $dictionary.glossLanguages,
          false,
          true
        );
        loading = false;
      }}
      form="primary">Download CSV & Images</Button>
  {:else}
    <Button
      onclick={async () => {
        loading = true;
        await downloadEntries($dictionary.id, $dictionary.name, $dictionary.glossLanguages);
        loading = false;
      }}
      form="primary">Download CSV</Button>
  {/if}
{:else}
  <Button disabled form="primary">Loading...</Button>
{/if}
