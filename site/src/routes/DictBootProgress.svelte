<script lang="ts">
  import { dict_boot_progress } from '$lib/db/dict-client/dict-boot-progress.svelte'

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

{#if dict_boot_progress.active}
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
