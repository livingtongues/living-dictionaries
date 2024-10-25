<script lang="ts">
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { page } from '$app/stores'

  export let data
  $: ({ is_manager, dictionary } = data)
</script>

<h3 class="text-xl font-semibold mb-4">{$page.data.t('misc.export')}</h3>
{#if $is_manager}
  The export feature is temporarily disabled while we make some database improvements. Please check back later.
{:else}
  <p>{$page.data.t('export.availability')}</p>
{/if}

<!-- {#if $admin}
  <div class="mt-5">
    <Button form="filled" href="entries/print">{$page.data.t('export.download_pdf')}</Button>
  </div>
{/if} -->

<SeoMetaTags
  title={$page.data.t('misc.export')}
  dictionaryName={$dictionary.name}
  description="Dictionary managers can easily export their Living Dictionary\'s text data as a .CSV spreadsheet as well as export their images and audio files in convenient ZIP folders."
  keywords="How to print a dictionary, How to create lessons for endangered languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
