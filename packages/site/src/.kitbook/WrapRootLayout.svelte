<script>
  import { pagesStore } from 'kitbook';
  import { setContext } from 'svelte';
  setContext('pages-store', pagesStore);

  /** @type {import('kitbook').KitbookSettings} */
  const kitbookSettings = {
    title: 'Living Dictionaries',
    description: 'Svelte Component Documentation and Prototyping Workbench built for Living Dictionaries using Kitbook',
    githubURL: 'https://github.com/livingtongues/living-dictionaries/tree/main/packages/site',
    expandTree: true,
  };

  setContext('kitbook-settings', kitbookSettings);
</script>

<slot />
