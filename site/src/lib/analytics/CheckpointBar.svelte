<script lang="ts">
  /**
   * The staleness stamp + Recompute control shared by `/admin/analytics` and
   * `/admin/health`.
   *
   * Both dashboards render a DAILY CHECKPOINT (see `analytics-snapshot.ts`) — the
   * server computes nothing on a page load, so "how old is this?" has to be on the
   * page, and "make it current" has to be a deliberate act. Recompute forks a niced
   * child; this then polls (a JSON file read, not a query) until the checkpoint's
   * timestamp changes, so the numbers appear without the operator guessing when to
   * hit reload.
   */
  import type { CheckpointStatus } from './checkpoint-status'
  import { invalidateAll } from '$app/navigation'
  import { api_admin_analytics_recompute } from '$api/admin/analytics/_call'
  import { format_date_time, format_relative_time } from '$lib/utils/format-relative-time'

  interface Props {
    checkpoint: CheckpointStatus
    /** Extra context for the line, e.g. `usage · last 30 days`. */
    label?: string
    /** No checkpoint exists at all — the pre-first-run state. */
    empty?: boolean
  }
  let { checkpoint, label = '', empty = false }: Props = $props()

  let requesting = $state(false)
  let waiting = $state(false)
  let failed = $state<string | null>(null)

  /** Poll at this cadence after a spawn; a 30-day compute is a couple of minutes. */
  const POLL_MS = 20_000
  const MAX_POLLS = 18 // ~6 minutes, then stop nagging the server

  async function recompute() {
    if (requesting || waiting)
      return
    requesting = true
    failed = null
    const started_generated_at = checkpoint.generated_at
    const { data, error } = await api_admin_analytics_recompute()
    requesting = false
    if (error || !data || data.outcome === 'failed') {
      failed = error?.message ?? 'could not start'
      return
    }
    waiting = true
    for (let poll = 0; poll < MAX_POLLS; poll++) {
      await new Promise(resolve => setTimeout(resolve, POLL_MS))
      await invalidateAll()
      if (checkpoint.generated_at !== started_generated_at)
        break
    }
    waiting = false
  }
</script>

<div class="bar">
  {#if empty}
    <span class="sub">No checkpoint computed yet — analytics are built once a day by a background job.</span>
  {:else}
    <span class="sub" title={checkpoint.generated_at ? format_date_time(checkpoint.generated_at) : ''}>
      {label}{label ? ' · ' : ''}<b>computed {checkpoint.generated_at ? format_relative_time(checkpoint.generated_at) : 'never'}</b>
      {#if checkpoint.computed_ms}<span class="cost">({(checkpoint.computed_ms / 1000).toFixed(1)}s)</span>{/if}
    </span>
  {/if}
  <button type="button" onclick={recompute} disabled={requesting || waiting || checkpoint.running}>
    {#if waiting || checkpoint.running}Computing…{:else if requesting}Starting…{:else}Recompute{/if}
  </button>
  {#if waiting}<span class="note">running in a low-priority background process — this page will update itself</span>{/if}
  {#if failed}<span class="note danger">Recompute failed: {failed}</span>{/if}
</div>

<style>
  .bar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .sub { color: var(--color-secondary); font-size: 0.8rem; }
  .cost { opacity: 0.6; }
  .note { color: var(--color-secondary); font-size: 0.75rem; }
  .note.danger { color: var(--danger); }
  button {
    font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 0.375rem;
    border: 1px solid var(--border-color); background: var(--surface);
    color: inherit; cursor: pointer;
  }
  button:disabled { opacity: 0.6; cursor: default; }
</style>
