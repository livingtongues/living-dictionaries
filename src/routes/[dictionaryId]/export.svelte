<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { dictionary } from '$lib/stores';
  import Button from '$svelteui/ui/Button.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import ExportingButton from './_ExportingButton.svelte';

  //Testing
  let imgs = ['https://i.imgur.com/0LVyDUY.jpeg', 'https://i.imgur.com/4AA1jC4.jpeg'];
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
