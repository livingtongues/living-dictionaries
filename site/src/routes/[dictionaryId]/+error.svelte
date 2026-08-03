<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import CrashReport from '$lib/components/shell/CrashReport.svelte'
  import NotFoundPanel from '$lib/components/shell/NotFoundPanel.svelte'
  import { log_error_page } from '$lib/debug/log-error-page'
  import { ResponseCodes } from '$lib/constants'

  // Anything thrown BELOW the dictionary layout (a dead `entry/[entryId]` id, an
  // unmatched sub-path) renders here — inside the dictionary's own chrome, with
  // the side menu intact and two ways back in. A failure in the dictionary
  // LAYOUT load lands on the root boundary instead, so `dictionary` is present.
  const { dictionary } = $derived(page.data)
  const not_found = $derived(page.status === ResponseCodes.NOT_FOUND)
  const is_entry = $derived(page.url?.pathname.includes('/entry/') ?? false)
  const dictionary_path = $derived(`/${encodeURIComponent(dictionary?.url || dictionary?.id || '')}`)

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

{#if not_found && dictionary}
  <NotFoundPanel
    title={is_entry ? page.data.t('error.entry_not_found') : page.data.t('error.page_not_found')}
    explanation="{is_entry ? page.data.t('error.not_found_explain') : page.data.t('error.page_moved_explain')} {page.data.t('error.dictionary_unaffected', { values: { dictionary: dictionary.name } })}"
    links={[
      { href: `${dictionary_path}/entries`, label: page.data.t('error.browse_entries'), primary: true },
      { href: dictionary_path, label: page.data.t('error.dictionary_home') },
    ]} />
{:else}
  <CrashReport />
{/if}
