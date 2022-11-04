<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { printGlosses } from '$lib/helpers/glosses';
  import type { IDictionary, IEntry } from '@living-dictionaries/types';

  export let entry: IEntry, dictionary: IDictionary;
  let shareImage = '';

  $: title = `${entry.lx} (${dictionary.name} Living Dictionary)`;
  $: description = printGlosses(entry.gl).join(', ');
  $: url = `https://livingdictionaries.app/${dictionary.id}/entry/${entry.id}`;
  $: if (entry.pf && entry.pf.gcs) {
    //The image only works without specifying the width
    shareImage = `https://lh3.googleusercontent.com/${entry.pf.gcs}`;
  } else {
    shareImage =
      'https://i2.wp.com/livingtongues.org/wp-content/uploads/2015/03/LT-logo-1.png?w=987&ssl=1';
  }
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="title" content={title} />
  <meta name="description" content={description} />

  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={shareImage} />
  <meta property="og:url" content={url} />
  <meta property="og:site_name" content={$_('misc.LD', { default: 'Living Dictionaries' })} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta property="twitter:url" content={url} />
  <meta property="twitter:title" content={title} />
  <meta property="twitter:description" content={description} />
  <meta property="twitter:image" content={shareImage} />
  <meta name="twitter:image:alt" content={title} />
</svelte:head>
