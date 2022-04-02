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
  input[type='checkbox'] {
    @apply focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded;
  }

  .form-input {
    @apply border-gray-300 rounded-md focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50;
  }
</style>
