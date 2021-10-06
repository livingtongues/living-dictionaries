<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { dictionary } from '$lib/stores';
  import Button from '$svelteui/ui/Button.svelte';
  import { downloadImages, downloadEntries } from './export/_fetchers';

  //Testing
  let imgs = [
    'https://i.imgur.com/0LVyDUY.jpeg',
    'https://i.imgur.com/4AA1jC4.jpeg',
    'https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/images%2Fmandarin-practice%2FmogAtD3lTCtkuwj7tLDD_1630105898118.jpg?alt=media',
  ];

  let data = false;
  let dataType = '';
  let images = false;
  let audio = false;

  $: if (!data) {
    dataType = '';
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
  <input id="public" type="checkbox" bind:checked={data} />
  <label for="public" class="mx-2 block leading-5 text-gray-900">
    <!-- {$_('create.visible_to_public', { default: 'Visible to Public' })} -->
    Data
  </label>
  <div class={`ml-8 mt-2 py-2 px-4 ${data ? '' : 'opacity-50 cursor-not-allowed'}`}>
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

{#if dataType === 'CSV' && !images}
  <Button
    onclick={() => {
      downloadEntries($dictionary.id, $dictionary.name);
    }}
    form="primary">Download CSV</Button>
{:else}
  <Button
    onclick={() => {
      if (data) {
        if (dataType === 'CSV') {
          downloadEntries($dictionary.id, $dictionary.name);
        }
      }
      if (images) {
        downloadImages(imgs);
      }
    }}
    form="primary">ZIP Export</Button>
{/if}
