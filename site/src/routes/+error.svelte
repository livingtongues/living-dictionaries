<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import Header from '$lib/components/shell/Header.svelte'
  import CrashReport from '$lib/components/shell/CrashReport.svelte'
  import NotFoundPanel from '$lib/components/shell/NotFoundPanel.svelte'
  import { log_error_page } from '$lib/debug/log-error-page'
  import { ResponseCodes } from '$lib/constants'

  const not_found = $derived(page.status === ResponseCodes.NOT_FOUND)

  onMount(() => {
    log_error_page({
      status: page.status,
      message: page.error?.message,
      url: page.url?.href,
      error_id: page.error?.error_id,
    })
  })
</script>

<svelte:head>
  <title>{page.data.t('misc.error')}: {page.status}</title>
</svelte:head>

<Header />

<div class="error-boundary">
  {#if not_found}
    <NotFoundPanel
      title={page.data.t('error.page_not_found')}
      explanation={page.data.t('error.page_moved_explain')}
      links={[
        { href: '/', label: page.data.t('error.go_home'), primary: true },
        { href: '/dictionaries', label: page.data.t('error.browse_dictionaries') },
      ]} />
  {:else}
    <CrashReport />
  {/if}
</div>

<style>
  .error-boundary {
    border-top: 1px solid var(--border-color);
  }
</style>
