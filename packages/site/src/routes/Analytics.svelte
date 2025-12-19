<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';

  const analyticsId = 'REPLACED_WITH_VERCEL_ANALYTICS_ID';

  onMount(async () => {
    if (!analyticsId.startsWith('REPLACED')) {
      const { measureWebVitals } = await import('$lib/webvitals');
      const current_page = get(page);
      measureWebVitals({ path: current_page.url.pathname, params: current_page.params, analyticsId });
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

{#if $page.url.host.includes('livingdictionaries.app')}
  {#await import('$lib/components/shell/LogRocket.svelte') then { default: LogRocket }}
    <LogRocket />
  {/await}
{/if}
