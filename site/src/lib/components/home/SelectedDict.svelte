<script lang="ts">
  import type { DictionaryView } from '$lib/types'
  import sanitize from 'xss'
  import { Button } from '$lib/svelte-pieces'
  import { page } from '$app/stores'
  import IconFa6SolidChevronRight from '~icons/fa6-solid/chevron-right'

  interface Props {
    dictionary: DictionaryView
  }

  const { dictionary }: Props = $props()
  // `about` is folded into the catalog row (legacy `dictionary_info`).
  const about = $derived(dictionary.about ?? '')

  function truncateString(str: string, num: number) {
    if (!str) return ''

    if (str.length <= num)
      return str

    return `${str.slice(0, num).trim()}...`
  }
</script>

<div>
  <div class="name-block">
    <h2>{dictionary.name}</h2>
    {#if dictionary.alternate_names?.length}
      <div class="alternate-names">
        ({dictionary.alternate_names.join(', ')})
      </div>
    {/if}
  </div>

  {#if dictionary.location}
    <div class="meta-row">
      <i class="far fa-globe-asia fa-fw"></i>
      {dictionary.location}
    </div>
  {/if}

  {#if dictionary.gloss_languages}
    <div class="meta-row">
      <i class="far fa-info-circle fa-fw"></i>
      {dictionary.gloss_languages.map(bcp => $page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })).join(', ')}
    </div>
  {/if}

  {#if dictionary.entry_count}
    <span class="stat-chip">
      {$page.data.t('dictionary.entries')}:&nbsp;
      <b>{dictionary.entry_count}</b>
    </span>
  {/if}

  {#if dictionary.iso_639_3}
    <span
      style="direction: ltr"
      class="stat-chip">
      ISO 639-3:&nbsp; <b>{dictionary.iso_639_3}</b>
    </span>
  {/if}
  {#if dictionary.glottocode}
    <span
      style="direction: ltr"
      class="stat-chip">
      Glottocode:&nbsp; <b>{dictionary.glottocode}</b>
    </span>
  {/if}

  {#if dictionary.metadata?.url}
    <Button target="_blank" class="open-button" form="filled" color="black" href={dictionary.metadata.url}>
      {$page.data.t('home.open_dictionary')}
    </Button>
  {:else}
    <div class="about-blurb inline-children-elements">
      {@html sanitize(truncateString(about, 200))}
      {#if about.length > 200}
        <a class="read-more" href={`${dictionary.url}/about`}>
          {$page.data.t('home.read_more')}
        </a>
      {/if}
    </div>
    <Button class="open-button" form="filled" color="black" href={dictionary.url}>
      {$page.data.t('home.open_dictionary')}
      <IconFa6SolidChevronRight class="icon-inline rtl-x-flip" style="margin-top: -0.25rem" />
    </Button>
  {/if}
  <!-- {#if lastFieldUpdatedAt}<p class="mt-3 text-xs text-gray-500">This dictionary was last updated on {new Date(lastFieldUpdatedAt).toString()}</p>{/if} -->
</div>

<style>
  :global(.inline-children-elements *) {
    display: inline;
  }

  .name-block,
  .meta-row {
    margin-bottom: 0.5rem;
  }

  h2 {
    font-size: 1.875rem;
    line-height: 2.25rem;
    font-weight: 600;
  }

  .alternate-names {
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
  }

  .stat-chip {
    margin: 0 0.5rem 0.5rem 0;
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1rem;
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
    color: var(--color); /* ≈ gray-800 */
  }

  div :global(.open-button) {
    margin-top: 0.25rem;
    width: 100%;
  }

  .about-blurb {
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  .read-more:hover {
    text-decoration-line: underline;
  }
</style>
