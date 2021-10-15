<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { dictionary } from '$lib/stores';
  import Button from '$svelteui/ui/Button.svelte';
  import { downloadEntries } from './export/_fetchers';
  import { glossingLanguages } from '$lib/export/glossing-languages-temp';
  import About from '../about.svelte';

  let data = true;
  let dataType = '';
  let images = false;
  let audio = false;
  let loading = false;

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
  <input id="public" type="checkbox" bind:checked={images} />
  <label for="public" class="mx-2 block leading-5 text-gray-900">
    <!-- {$_('create.visible_to_public', { default: 'Visible to Public' })} -->
    Images
  </label>
  <input id="public" type="checkbox" bind:checked={audio} />
  <label for="public" class="mx-2 block leading-5 text-gray-900">
    <!-- {$_('create.visible_to_public', { default: 'Visible to Public' })} -->
    Audio
  </label>
</div>

{#if !loading}
  {#if images && audio}
    <Button
      onclick={() => {
        loading = true;
        downloadEntries($dictionary.id, $dictionary.name, $dictionary.glossLanguages, true, true);
      }}
      form="primary">Download CSV & Audio & Images</Button>
  {:else if audio && !images}
    <Button
      onclick={() => {
        loading = true;
        downloadEntries($dictionary.id, $dictionary.name, $dictionary.glossLanguages, true);
      }}
      form="primary">Download CSV & Audio</Button>
  {:else if images && !audio}
    <Button
      onclick={() => {
        loading = true;
        downloadEntries($dictionary.id, $dictionary.name, $dictionary.glossLanguages, false, true);
      }}
      form="primary">Download CSV & Images</Button>
  {:else}
    <Button
      onclick={() => {
        loading = true;
        downloadEntries($dictionary.id, $dictionary.name, $dictionary.glossLanguages);
      }}
      form="primary">Download CSV</Button>
  {/if}
{:else}
  <Button disabled form="primary">Loading...</Button>
{/if}

<!-- {#if dataType === 'CSV' && !images}
  <Button
    onclick={() => {
      downloadEntries($dictionary.id, $dictionary.name, $dictionary.glossLanguages);
    }}
    form="primary">Download CSV</Button>
{:else}
  <Button
    onclick={() => {
      if (data) {
        if (dataType === 'CSV') {
          downloadEntries($dictionary.id, $dictionary.name, $dictionary.glossLanguages);
        }
      }
      if (images) {
        downloadEntries($dictionary.id, $dictionary.name, $dictionary.glossLanguages, false, true);
      }
    }}
    form="primary">ZIP Export</Button>
{/if} -->
