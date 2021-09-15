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
</script>

<svelte:head>
  <title>
    {$dictionary.name}
    {$_('misc.export', { default: 'export' })}
  </title>
</svelte:head>

<h3 class="text-xl font-semibold">{$_('misc.export', { default: 'export' })}</h3>

<ShowHide let:show let:toggle>
  <ExportingButton images={imgs} />
</ShowHide>
