<script lang="ts">
  import { browser } from '$app/environment';
  import 'virtual:windi.css';
  import '../global.css';
  import { _ } from 'svelte-i18n';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let analyticsId = import.meta.env.VERCEL_ANALYTICS_ID as string;

  onMount(async () => {
    if (analyticsId) {
      const { measureWebVitals } = await import('$lib/webvitals');
      measureWebVitals({ path: $page.url.pathname, params: $page.params, analyticsId });
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
