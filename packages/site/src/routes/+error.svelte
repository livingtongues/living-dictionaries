<script lang="ts">
  import { onMount } from 'svelte'
  import { Button, ShowHide } from 'svelte-pieces'
  import { page } from '$app/stores'
  import Header from '$lib/components/shell/Header.svelte'
  import { dev } from '$app/environment'

  onMount(async () => {
    const Sentry = await import('@sentry/browser')
    const eventId = Sentry.captureException($page.error)
    console.error('sent error', eventId)
  // https://docs.sentry.io/enriching-error-data/user-feedback
    // Sentry.showReportDialog({ eventId });
  })
</script>

<svelte:head>
  <title>{$page.data.t('misc.error')}: {$page.status}</title>
</svelte:head>

<Header />

<div class="p-4 bg-white relative z-20 border-t">
  <h2 class="text-xl sm:text-4xl font-bold mb-3">
    {$page.data.t('error.run_into_error')}
  </h2>

  <p class="mb-3">
    {$page.data.t('error.error_recorded')}

    <b>
      {$page.data.t('error.please_explain')}
    </b>
  </p>

  <ShowHide let:show let:toggle>
    <Button form="filled" onclick={toggle}>{$page.data.t('header.contact_us')}</Button>
    {#if show}
      {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
        <Contact subject="report_problem" on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>

  <p class="text-gray-600 text-sm mt-6">
    {$page.data.t('misc.error')}:
    {$page.status}
    -
    {$page.error.message}
  </p>

  {#if dev && $page.error.message}
    <div class="w-full overflow-x-auto">
      <pre>{JSON.stringify($page.error, null, 2)}</pre>
    </div>
  {/if}
</div>
