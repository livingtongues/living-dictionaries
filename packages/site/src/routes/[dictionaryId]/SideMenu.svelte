<script lang="ts">
  export let menuOpen: boolean;
  import { _ } from 'svelte-i18n';
  import { dictionary, isManager } from '$lib/stores';
  import { page } from '$app/stores';
</script>

<div class="md:hidden">
  <a href="/" class="block p-3 text-lg font-semibold mb-3 border-b">
    {$_('misc.LD', { default: 'Living Dictionaries' })}
  </a>
  <h5 class="font-semibold uppercase tracking-wide mx-3 mb-2">
    {$dictionary.name}
  </h5>
</div>
<div on:click={() => (menuOpen = false)}>
  <a
    class:active={$page.url.pathname.match(/entry|entries/)}
    href={`/${$dictionary.id}/entries/list`}>
    <i class="far fa-list fa-fw" />
    <span class="font-medium mx-2">
      {$_('dictionary.entries', { default: 'Entries' })}
    </span>
    <span class="flex-grow" />
    <span
      class="inline-block py-1 px-2 leading-none text-xs font-semibold
        text-gray-700 bg-gray-300 rounded-full">
      {new Intl.NumberFormat().format($dictionary.entryCount || 0)}
    </span>
  </a>
  <a
    href={'/' + $dictionary.id + '/about'}
    class:active={$page.url.pathname.includes('about')}>
    <i class="far fa-info-circle fa-fw" />
    <span class="font-medium mx-2">
      {$_('header.about', { default: 'About' })}
    </span>
  </a>
  <a
    href={'/' + $dictionary.id + '/contributors'}
    class:active={$page.url.pathname.includes('contributors')}>
    <i class="far fa-users fa-fw" />
    <span class="font-medium mx-2">
      {$_('dictionary.contributors', { default: 'Contributors' })}
    </span>
  </a>
  <a
    href={'/' + $dictionary.id + '/grammar'}
    class:active={$page.url.pathname.includes('grammar')}>
    <i class="far fa-edit fa-fw" />
    <span class="font-medium mx-2">
      {$_('dictionary.grammar', { default: 'Grammar' })}
    </span>
  </a>
  <a
    href={'/' + $dictionary.id + '/batch-import'}
    class:active={$page.url.pathname.includes('grammar')}>
    <i class="far fa-file-import" />
    <span class="font-medium mx-2">
      {$_('header.batch-import', {
        default: 'Batch Import',
      })}
    </span>
  </a>
  {#if $isManager}
    <a
      href={'/' + $dictionary.id + '/settings'}
      class:active={$page.url.pathname.includes('settings')}>
      <i class="far fa-cog fa-fw" />
      <span class="font-medium mx-2">
        {$_('misc.settings', { default: 'Settings' })}
      </span>
    </a>
  {/if}
  {#if $isManager}
    <a
      href={'/' + $dictionary.id + '/export'}
      class:active={$page.url.pathname.includes('export')}>
      <i class="far fa-download" />
      <span class="font-medium mx-2">
        {$_('misc.export', { default: 'Export' })}
      </span>
    </a>
  {/if}
</div>

<div class="mt-auto" />

<a href="/terms" target="_blank" class="link">
  {$_('dictionary.terms_of_use', { default: 'Terms of Use' })}
</a>
<a href="https://www.youtube.com/static?template=terms" target="_blank" rel="noopener noreferrer" class="link">
  {$_('dictionary.youtube_terms', { default: 'YouTube terms' })}
</a>
<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" class="link mb-3">
  {$_('dictionary.google_terms', { default: 'Google terms' })}
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
