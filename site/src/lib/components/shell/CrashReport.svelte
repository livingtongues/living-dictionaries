<!--
  The apology + report path for a genuine fault (5xx and anything we didn't
  expect). Shared by the root error boundary and the per-dictionary one so a real
  crash reads the same wherever it happens. A 404 must NOT come here — see
  NotFoundPanel.
-->
<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import { dev } from '$app/environment'
</script>

<div class="crash-panel">
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
  .crash-panel {
    padding: 1rem;
    background-color: var(--background);
    position: relative;
    z-index: 20;
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
