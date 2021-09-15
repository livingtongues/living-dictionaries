<script lang="ts">
  export let menuOpen: boolean;
  import { _ } from 'svelte-i18n';
  import { dictionary, isManager, admin } from '$lib/stores';
  import { page } from '$app/stores';
</script>

<div class="md:hidden">
  <a href="/" class="block p-3 text-lg font-semibold mb-3 border-b">
    {$_('misc.LD', { default: 'Living Dictionaries' })}
  </a>
  <h5 class="text-xs font-semibold uppercase tracking-wide mx-3 mb-2">
    {$dictionary.name}
  </h5>
</div>
<div on:click={() => (menuOpen = false)}>
  <!-- <a sveltekit:prefetch href={'/' + $dictionary.id}>
    <i class="far fa-th-large fa-fw text-lg" />
    <span class="font-medium mx-2">{$_('dictionary.overview', { default: 'Overview' })}</span>
  </a> -->
  <a
    sveltekit:prefetch
    class:active={$page.path.match(/entry|entries/)}
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
    sveltekit:prefetch
    href={'/' + $dictionary.id + '/about'}
    class:active={$page.path.includes('about')}>
    <i class="far fa-info-circle fa-fw" />
    <span class="font-medium mx-2">
      {$_('header.about', { default: 'About' })}
    </span>
  </a>
  <a
    sveltekit:prefetch
    href={'/' + $dictionary.id + '/contributors'}
    class:active={$page.path.includes('contributors')}>
    <i class="far fa-users fa-fw" />
    <span class="font-medium mx-2">
      {$_('dictionary.contributors', { default: 'Contributors' })}
    </span>
  </a>
  <a
    sveltekit:prefetch
    href={'/' + $dictionary.id + '/grammar'}
    class:active={$page.path.includes('grammar')}>
    <i class="far fa-edit fa-fw" />
    <span class="font-medium mx-2">
      {$_('dictionary.grammar', { default: 'Grammar' })}
    </span>
  </a>
  {#if $isManager}
    <a
      sveltekit:prefetch
      href={'/' + $dictionary.id + '/settings'}
      class:active={$page.path.includes('settings')}>
      <i class="far fa-cog fa-fw" />
      <span class="font-medium mx-2">
        {$_('misc.settings', { default: 'Settings' })}
      </span>
    </a>
  {/if}
  {#if $admin > 1}
    <a
      sveltekit:prefetch
      href={'/' + $dictionary.id + '/export'}
      class:active={$page.path.includes('export')}>
      <i class="far fa-download" />
      <span class="font-medium mx-2">
        {$_('misc.export', { default: 'export' })}
      </span>
    </a>
  {/if}
</div>
<div class="mt-auto" />

<a href="/terms" target="_blank" class="link">
  {$_('dictionary.terms_of_use', { default: 'Terms of Use' })}
</a>
<a href="https://www.youtube.com/static?template=terms" target="_blank" class="link">
  {$_('dictionary.youtube_terms', { default: 'YouTube terms' })}
</a>
<a href="https://policies.google.com/privacy" target="_blank" class="link mb-3">
  {$_('dictionary.google_terms', { default: 'Google terms' })}
</a>

<style>
  a:not(.link) {
    @apply text-gray-600 hover:bg-gray-200 px-3 py-2 flex items-center md:rounded-lg mb-2;
  }
  .active {
    @apply bg-gray-200 text-gray-900;
  }
  .link {
    @apply block text-sm pl-3 font-medium text-gray-700 hover:underline py-1;
    font-size: 0.78em;
  }
</style>
