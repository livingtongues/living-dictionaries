<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import { page } from '$app/stores'

  export let dictionary: Tables<'dictionaries'>
  export let entry_count: number
  export let on_close: () => void
  export let is_manager: boolean
</script>

<div class="md:hidden">
  <a href="/" class="block p-3 text-lg font-semibold mb-3 border-b">
    {$page.data.t('misc.LD')}
  </a>
  <h5 class="font-semibold uppercase tracking-wide mx-3 mb-2">
    {dictionary.name}
  </h5>
</div>
<div on:click={on_close}>
  <a
    class:active={$page.url.pathname.match(/entry|entries/)}
    href={`/${dictionary.url}/entries`}>
    <span class="i-fa-solid-list" />
    <span class="font-medium mx-2">
      {$page.data.t('dictionary.entries')}
    </span>
    <span class="flex-grow" />
    {#if entry_count}
      <span
        class="inline-block py-1 px-2 leading-none text-xs font-semibold
          text-gray-700 bg-gray-300 rounded-full">
        {new Intl.NumberFormat().format(entry_count)}
      </span>
    {/if}
  </a>
  {#if !is_manager}
    <a
      href={`/${dictionary.url}/synopsis`}
      class:active={$page.url.pathname.includes('synopsis')}>
      <span class="i-fa6-solid-file-lines" />
      <span class="font-medium mx-2">
        {$page.data.t('synopsis.name')}
      </span>
    </a>
  {/if}
  <a
    href={`/${dictionary.url}/about`}
    class:active={$page.url.pathname.includes('about')}>
    <span class="i-fa6-solid-circle-info mx-.25" />
    <span class="font-medium mx-2">
      {$page.data.t('header.about')}
    </span>
  </a>
  <a
    href={`/${dictionary.url}/grammar`}
    class:active={$page.url.pathname.includes('grammar')}>
    <span class="i-tabler-text-grammar text-lg" />
    <span class="font-medium mx-2">
      {$page.data.t('dictionary.grammar')}
    </span>
  </a>
  <a
    href={`/${dictionary.url}/contributors`}
    class:active={$page.url.pathname.includes('contributors')}>
    <span class="i-fa6-solid-users text-lg" />
    <span class="font-medium mx-2">
      {$page.data.t('dictionary.contributors')}
    </span>
  </a>
  {#if is_manager}
    <a
      href={`/${dictionary.url}/history`}
      class:active={$page.url.pathname.includes('history')}>
      <span class="i-mdi-history text-xl" />
      <span class="font-medium mx-2">
        {$page.data.t('history.history')}
      </span>
    </a>
    <a
      href={`/${dictionary.url}/settings`}
      class:active={$page.url.pathname.includes('settings')}>
      <span class="i-fa6-solid-gear mx-.5" />
      <span class="font-medium mx-2">
        {$page.data.t('misc.settings')}
      </span>
    </a>
    <a
      href={`/${dictionary.url}/import`}
      class:active={$page.url.pathname.includes('import')}>
      <span class="i-fa6-solid-file-import mx-.5" />
      <span class="font-medium mx-2">
        {$page.data.t('import_page.import')}
      </span>
    </a>
    <a
      href={`/${dictionary.url}/export`}
      class:active={$page.url.pathname.includes('export')}>
      <span class="i-fa6-solid-file-export ml-1" />
      <span class="font-medium mx-2">
        {$page.data.t('misc.export')}
      </span>
    </a>
  {/if}
</div>

<div class="mt-auto" />

<a href="/terms" target="_blank" class="link">
  {$page.data.t('dictionary.terms_of_use')}
</a>
<a href="https://www.youtube.com/static?template=terms" target="_blank" rel="noopener noreferrer" class="link">
  {$page.data.t('dictionary.youtube_terms')}
</a>
<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" class="link mb-3">
  {$page.data.t('dictionary.google_terms')}
</a>

<style>
  a:not(.link) {
    --at-apply: text-gray-600 hover:bg-gray-200 px-3 py-2 flex items-center md:rounded-lg mb-2;
  }
  .active {
    --at-apply: bg-gray-200 text-gray-900;
  }
  .link {
    --at-apply: block text-sm pl-3 font-medium text-gray-700 hover:underline py-1;
    font-size: 0.78em;
  }
</style>
