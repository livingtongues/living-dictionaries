<script lang="ts">
  import { page } from '$app/stores';
  import type { IDictionary } from '@living-dictionaries/types';
  import { firebaseConfig } from 'sveltefirets';

  export let dictionary: IDictionary
  export let on_close: () => void;
  export let admin: number
  export let is_manager: boolean
  export let search_index_updated: boolean
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
    class:active={$page.url.pathname.match(/entry|entries\//)}
    href={`/${dictionary.id}/entries/list`}>
    <i class="far fa-list fa-fw" />
    <span class="font-medium mx-2">
      {$page.data.t('dictionary.entries')}
    </span>
    <span class="flex-grow" />
    <span
      class="inline-block py-1 px-2 leading-none text-xs font-semibold
        text-gray-700 bg-gray-300 rounded-full">
      {new Intl.NumberFormat().format(dictionary.entryCount || 0)}
    </span>
  </a>
  {#if admin || firebaseConfig.projectId === 'talking-dictionaries-dev'}
    <a
      class:active={$page.url.pathname.match(/entries-local/)}
      href={`/${dictionary.id}/entries-local/list`}>
      <!-- <span class="i-fa6-solid-list " /> -->
      <span class="font-medium mx-2">
        {$page.data.t('dictionary.entries')} (local)
      </span>
      <span class="flex-grow" />
      {#if search_index_updated}
        <span
          class="inline-block py-1 px-2 leading-none text-xs font-semibold
            text-gray-700 bg-gray-300 rounded-full">
          {new Intl.NumberFormat().format(dictionary.entryCount || 0)}
        </span>
      {/if}
    </a>
  {/if}
  <a
    href={'/' + dictionary.id + '/about'}
    class:active={$page.url.pathname.includes('about')}>
    <i class="far fa-info-circle fa-fw" />
    <span class="font-medium mx-2">
      {$page.data.t('header.about')}
    </span>
  </a>
  <a
    href={'/' + dictionary.id + '/contributors'}
    class:active={$page.url.pathname.includes('contributors')}>
    <i class="far fa-users fa-fw" />
    <span class="font-medium mx-2">
      {$page.data.t('dictionary.contributors')}
    </span>
  </a>
  <a
    href={'/' + dictionary.id + '/grammar'}
    class:active={$page.url.pathname.includes('grammar')}>
    <i class="far fa-edit fa-fw" />
    <span class="font-medium mx-2">
      {$page.data.t('dictionary.grammar')}
    </span>
  </a>
  {#if is_manager}
    <a
      href={'/' + dictionary.id + '/import'}
      class:active={$page.url.pathname.includes('import')}>
      <i class="far fa-file-import" />
      <span class="font-medium mx-2">
        {$page.data.t('import_page.import')}
      </span>
    </a>
    <a
      href={'/' + dictionary.id + '/settings'}
      class:active={$page.url.pathname.includes('settings')}>
      <i class="far fa-cog fa-fw" />
      <span class="font-medium mx-2">
        {$page.data.t('misc.settings')}
      </span>
    </a>
    <a
      href={'/' + dictionary.id + '/export'}
      class:active={$page.url.pathname.includes('export')}>
      <i class="far fa-download" />
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
