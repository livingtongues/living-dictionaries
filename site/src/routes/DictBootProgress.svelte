<script lang="ts">
  import { dict_boot_progress } from '$lib/db/dict-client/dict-boot-progress.svelte'
  import { reset_dict_local_storage } from '$lib/db/dict-client/reset-dict-storage'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import IconMdiAlertCircleOutline from '~icons/mdi/alert-circle-outline'
  import { page } from '$app/state'

  // The boot ladder gave up (`$lib/db/dict-client/boot-give-up.ts`). Before
  // 2026-08-03 this state simply did not render: the bar kept animating forever
  // while the person waited — 9.5 minutes of it in the worst measured case.
  const failure = $derived(dict_boot_progress.failure)

  let resetting = $state(false)
  async function reset_and_redownload() {
    if (!failure)
      return
    // An editor's local copy may hold un-pushed writes that an UNOPENABLE file can
    // never be checked for — so ask first, and say what the tradeoff is. A viewer's
    // copy is losslessly re-downloadable, so nothing gets in their way.
    if (failure.has_editor_role && !confirm(page.data.t('misc.dict_reset_confirm')))
      return
    resetting = true
    await reset_dict_local_storage({ dict_id: failure.dict_id })
  }

  // Only a COLD dict boot that actually downloads a snapshot flips `active` on
  // (see the store) — warm OPFS re-opens and follower tabs never show this.
  const STAGE_LABELS: Record<string, string> = {
    snapshot_fetch: 'Downloading dictionary…',
    opfs_open: 'Opening dictionary…',
    migrate: 'Preparing dictionary…',
    engine_start: 'Starting sync…',
  }

  const downloading = $derived(dict_boot_progress.stage === 'snapshot_fetch')
  const fraction = $derived(
    downloading && dict_boot_progress.total_bytes
      ? Math.min(dict_boot_progress.received_bytes / (dict_boot_progress.total_bytes || 1), 1)
      : null,
  )
  // Determinate while downloading with a known total; full once the download is
  // done and we're opening/migrating; indeterminate for an unknown-size download.
  const indeterminate = $derived(downloading && fraction === null)
  const width_pct = $derived(fraction !== null ? Math.round(fraction * 100) : (downloading ? 0 : 100))

  const label = $derived(STAGE_LABELS[dict_boot_progress.stage] || 'Loading dictionary…')

  function mb(bytes: number): string {
    return `${(bytes / 1_000_000).toFixed(1)} MB`
  }

  const detail = $derived.by(() => {
    if (!downloading)
      return ''
    if (dict_boot_progress.total_bytes)
      return `${mb(dict_boot_progress.received_bytes)} / ${mb(dict_boot_progress.total_bytes)}`
    return mb(dict_boot_progress.received_bytes)
  })
</script>

{#if failure}
  <div class="boot-failure" role="alert">
    <div class="failure-head">
      <IconMdiAlertCircleOutline class="failure-icon" />
      <span class="failure-title">{page.data.t('misc.dict_open_failed')}</span>
    </div>
    <p class="failure-body">{page.data.t('misc.dict_open_failed_explanation')}</p>
    {#if failure.has_editor_role}
      <p class="failure-warning">{page.data.t('misc.dict_open_failed_editor_warning')}</p>
    {/if}
    <div class="failure-actions">
      <HeadlessButton class="btn-primary btn-default" loading={resetting} onclick={reset_and_redownload}>
        {page.data.t('misc.dict_reset_and_redownload')}
      </HeadlessButton>
      <HeadlessButton class="btn-outline btn-default" onclick={() => location.reload()}>
        {page.data.t('misc.reload')}
      </HeadlessButton>
    </div>
    <p class="failure-detail">{failure.boot_message}{#if failure.last_stage}&nbsp;·&nbsp;{failure.last_stage}{/if}</p>
  </div>
{:else if dict_boot_progress.active}
  <div
    class="boot-track"
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={fraction !== null ? width_pct : undefined}>
    <div class="boot-bar" class:indeterminate style="width: {indeterminate ? 100 : width_pct}%"></div>
  </div>
  <div class="boot-chip">
    <span class="boot-label">{label}</span>
    {#if detail}
      <span class="boot-detail">{detail}{#if fraction !== null}&nbsp;·&nbsp;{width_pct}%{/if}</span>
    {/if}
  </div>
{/if}

<style>
  /* The give-up state. Deliberately a blocking card, not a toast: a dictionary
     that cannot open is not a passing notice, and the action is the whole point. */
  .boot-failure {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1001;
    width: calc(100% - 24px);
    max-width: 460px;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--default-border-color);
    background-color: var(--background);
    color: var(--color);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  }
  .failure-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    color: var(--danger);
  }
  .failure-title {
    font-size: 15px;
    line-height: 1.3;
  }
  .failure-body {
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--color-secondary);
  }
  .failure-warning {
    margin: 10px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--color);
    background-color: color-mix(in srgb, var(--warning) 14%, var(--background));
    border: 1px solid color-mix(in srgb, var(--warning) 34%, var(--background));
  }
  .failure-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
  .failure-detail {
    margin: 10px 0 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-secondary);
    word-break: break-word;
  }

  .boot-track {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background-color: rgba(88, 80, 236, 0.15);
    z-index: 1000;
    overflow: hidden;
  }
  .boot-bar {
    height: 100%;
    background-color: #5850ec;
    transition: width 0.3s ease-out;
  }
  .boot-bar.indeterminate {
    width: 40% !important;
    animation: boot-indeterminate 1.1s ease-in-out infinite;
  }
  @keyframes boot-indeterminate {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(275%); }
  }
  .boot-chip {
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    border-radius: 9999px;
    background-color: #1e293b;
    color: white;
    font-size: 12px;
    line-height: 1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    white-space: nowrap;
  }
  .boot-label {
    font-weight: 600;
  }
  .boot-detail {
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }
</style>
