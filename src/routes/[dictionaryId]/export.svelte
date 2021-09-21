<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { dictionary } from '$lib/stores';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import ExportingButton from './_ExportingButton.svelte';

  //Testing
  let imgs = [
    'https://i.imgur.com/0LVyDUY.jpeg',
    'https://i.imgur.com/4AA1jC4.jpeg',
    'https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/images%2Fmandarin-practice%2FmogAtD3lTCtkuwj7tLDD_1630105898118.jpg?alt=media',
  ];
  let CSV = false;
  let images = false;
  let audio = false;
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

<div class="flex items-center mt-2 mb-6">
  <input id="public" type="checkbox" bind:checked={CSV} />
  <label for="public" class="mx-2 block leading-5 text-gray-900">
    <!-- {$_('create.visible_to_public', { default: 'Visible to Public' })} -->
    CSV
  </label>
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

<ShowHide let:show let:toggle>
  <ExportingButton images={imgs} />
</ShowHide>
