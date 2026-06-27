<script lang="ts">
  import { onMount } from 'svelte'
  import { Button, ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import Header from '$lib/components/shell/Header.svelte'
  import Footer from '$lib/components/shell/Footer.svelte'
  import { dev } from '$app/environment'
  import { init_remote_logging, log_event } from '$lib/debug/remote-log'

  onMount(() => {
    init_remote_logging()
    // Map the HTTP status to a severity so expected gates don't read as crashes:
    // 5xx = crash (a real failure), 401/403 = warn (auth gate, e.g. an anon user
    // hitting /admin/*), 404 = info, anything else = error.
    const { status } = page
    const level = status >= 500 ? 'crash' : (status === 401 || status === 403) ? 'warn' : status === 404 ? 'info' : 'error'
    log_event({
      level,
      message: page.error?.message || 'Error page shown',
      context: { status, url: page.url?.href },
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
      <Button form="filled" onclick={toggle}>{page.data.t('header.contact_us')}</Button>
      {#if show}
        {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
          <Contact subject="report_problem" on:close={toggle} />
        {/await}
      {/if}
    {/snippet}
  </ShowHide>

  <p class="error-detail">
    {page.data.t('misc.error')}:
    {page.status}
    -
    {page.error.message}
  </p>

  {#if dev && page.error.message}
    <div style="width: 100%; overflow-x: auto">
      <pre>{JSON.stringify(page.error, null, 2)}</pre>
    </div>
  {/if}
</div>

<Footer />

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
