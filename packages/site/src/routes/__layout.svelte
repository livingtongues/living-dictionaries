<script context="module" lang="ts">
  import { loadLocaleOnClient, loadLocaleOnServer } from '$lib/i18n';
  import { browser } from '$app/env';

  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ params, url: { pathname }, session }) => {
    if (browser) {
      await loadLocaleOnClient();
    } else {
      await loadLocaleOnServer(session.chosenLocale, session.acceptedLanguage);
    }
    return {
      props: {
        params,
        path: pathname,
      },
    };
  };
</script>

<script lang="ts">
  import '../global.css';
  import { _ } from 'svelte-i18n';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let analyticsId = import.meta.env.VERCEL_ANALYTICS_ID as string;
  export let path: string;
  export let params: Record<string, string>;

  onMount(async () => {
    if (analyticsId) {
      const { measureWebVitals } = await import('$lib/webvitals');
      measureWebVitals({ path, params, analyticsId });
    }

    const { init } = await import('@sentry/browser');
    // const { Integrations } = await import('@sentry/tracing');
    init({
      dsn: 'https://b344dd4315d54249afd9c03762aec0c9@o424638.ingest.sentry.io/5888340',
      // integrations: [new Integrations.BrowserTracing()],

      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring. We recommend adjusting this value in production
      // tracesSampleRate: 1.0,
    });
  });
</script>

<div id="direction" dir={$_('direction')}>
  <slot />
</div>

{#if browser}
  {#await import('$lib/components/shell/NProgress.svelte') then { default: NProgress }}
    <NProgress />
  {/await}

  {#if $page.url.host.includes('livingdictionaries.app')}
    {#await import('$lib/components/shell/LogRocket.svelte') then { default: LogRocket }}
      <LogRocket />
    {/await}
  {/if}
{/if}

<style windi:preflights:global windi:safelist:global global>
  /* Temporary workaround until forms plugin bug in https://github.com/windicss/windicss/issues/457 is fixed */
  [type='text'],
  [type='email'],
  [type='url'],
  [type='password'],
  [type='number'],
  [type='date'],
  [type='datetime-local'],
  [type='month'],
  [type='search'],
  [type='tel'],
  [type='time'],
  [type='week'],
  [multiple],
  textarea,
  select {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-color: #fff;
    border-color: #6b7280;
    border-width: 1px;
    border-radius: 0px;
    padding-top: 0.5rem;
    padding-right: 0.75rem;
    padding-bottom: 0.5rem;
    padding-left: 0.75rem;
    font-size: 1rem;
    line-height: 1.5rem;
  }
  /* End workaround */

  input[type='checkbox'] {
    @apply focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded;
  }

  .form-input {
    @apply border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50;
  }
</style>
