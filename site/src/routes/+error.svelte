<script lang="ts">
  import { onMount } from 'svelte'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import Header from '$lib/components/shell/Header.svelte'
  import { dev } from '$app/environment'
  import { init_remote_logging, log_event } from '$lib/debug/remote-log'
  import { http_status_to_log_level } from '$lib/debug/classify-error'
  import { take_client_error } from '$lib/debug/last-client-error'

  onMount(() => {
    init_remote_logging()
    // Map the HTTP status to a severity so expected gates don't read as crashes
    // (shared with the analytics side via `classify-error`).
    const { status } = page
    const level = http_status_to_log_level(status)
    // `page.error.message` is SvelteKit's sanitized text ("Internal Error") for
    // anything that broke in the BROWSER — which is why this row was
    // unattributable for its whole history. `hooks.client.ts` parks the real
    // exception for us; a server-rendered error page parks nothing and instead
    // carries an `error_id` naming the server row that already holds the stack.
    const cause = take_client_error()
    log_event({
      level,
      message: page.error?.message || 'Error page shown',
      stack: cause?.stack ?? null,
      context: {
        status,
        url: page.url?.href,
        cause: cause?.message ?? null,
        error_id: page.error?.error_id ?? null,
        origin: page.error?.error_id ? 'server' : 'client',
      },
    })
  })
</script>

<svelte:head>
  <title>{page.data.t('misc.error')}: {page.status}</title>
</svelte:head>

<Header />

<div class="error-panel">
  <h2>
    {page.data.t('error.run_into_error')}
  </h2>

  <p class="explain">
    {page.data.t('error.error_recorded')}

    <b>
      {page.data.t('error.please_explain')}
    </b>
  </p>

  <ShowHide>
    {#snippet children({ show, toggle })}
      <HeadlessButton class="btn-primary btn-default" onclick={toggle}>{page.data.t('header.contact_us')}</HeadlessButton>
      {#if show}
        {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
          <Contact subject="report_problem" on_close={toggle} />
        {/await}
      {/if}
    {/snippet}
  </ShowHide>

  <p class="error-detail">
    {page.data.t('misc.error')}:
    {page.status}
    -
    {page.error.message}
    <!-- Server-side 5xx only: the reference that finds the stack in telemetry. -->
    {#if page.error.error_id}
      <br>
      <code>ref: {page.error.error_id}</code>
    {/if}
  </p>

  {#if dev && page.error.message}
    <div style="width: 100%; overflow-x: auto">
      <pre>{JSON.stringify(page.error, null, 2)}</pre>
    </div>
  {/if}
</div>

<style>
  .error-panel {
    padding: 1rem;
    background-color: var(--background);
    position: relative;
    z-index: 20;
    border-top: 1px solid var(--border-color);
  }

  h2 {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }

  @media (min-width: 640px) {
    h2 {
      font-size: 2.25rem;
      line-height: 2.5rem;
    }
  }

  .explain {
    margin-bottom: 0.75rem;
  }

  .error-detail {
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    font-size: 0.875rem;
    line-height: 1.25rem;
    margin-top: 1.5rem;
  }
</style>
