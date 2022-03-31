<script context="module" lang="ts">
  import { loadLocaleOnClient, loadLocaleOnServer } from '$lib/i18n';
  import { browser } from '$app/env';

  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ page: { path, params }, session }) => {
    if (browser) {
      await loadLocaleOnClient();
    } else {
      await loadLocaleOnServer(session.chosenLocale, session.acceptedLanguage);
    }
    return {
      props: {
        params,
        path,
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

  {#if $page.host.includes('livingdictionaries.app')}
    {#await import('$lib/components/shell/LogRocket.svelte') then { default: LogRocket }}
      <LogRocket />
    {/await}
  {/if}
{/if}
