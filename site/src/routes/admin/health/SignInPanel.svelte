<script lang="ts">
  import type { SignInHealth } from '$lib/db/server/log-analytics'
  import ComboChart from '$lib/charts/ComboChart.svelte'
  import { USERS_COLOR } from '$lib/analytics/dashboard-format'
  import { format_number } from '$lib/constants'

  /** Logins per method per day, plus new accounts — plain reporting, no verdict. */
  interface Props {
    sign_in: SignInHealth
  }

  const { sign_in }: Props = $props()

  const COLORS = ['var(--primary)', USERS_COLOR, 'var(--color-secondary)']
  const methods = $derived([...new Set(sign_in.daily.flatMap(point => Object.keys(point.methods)))].sort())
  const series = $derived(methods.map((method, index) => ({
    label: method,
    color: COLORS[index % COLORS.length],
    points: sign_in.daily.map(point => ({ date: point.day, value: point.methods[method] ?? 0 })),
  })))
</script>

<section class="panel">
  <h2>Sign-in <span class="hint">logins per method · last complete day ({sign_in.day})</span></h2>
  {#if sign_in.methods.length}
    <p class="verdict">
      {format_number(sign_in.logins)} login{sign_in.logins === 1 ? '' : 's'}
      <span class="hint">· {sign_in.methods.map(method => `${format_number(method.logins)} ${method.method}`).join(' · ')} · {format_number(sign_in.new_accounts)} new account{sign_in.new_accounts === 1 ? '' : 's'}</span>
    </p>
    {#if series.length && sign_in.daily.length > 1}
      <ComboChart series={series} height={150} />
    {/if}
  {:else}
    <p class="muted">No logins recorded in this window.</p>
  {/if}
</section>

<style>
  /* Matches the other /admin/health panels (HealthView's `.panel` / `.hint`). */
  .panel {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.625rem;
    padding: 1rem 1.125rem;
  }
  h2 {
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 0 0 0.75rem;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .hint {
    font-weight: 400;
    font-size: 0.72rem;
    color: var(--color-secondary);
  }
  .verdict {
    margin: 0 0 0.5rem;
    font-size: 1.125rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .muted {
    color: var(--color-secondary);
    font-size: 0.875rem;
    margin: 0;
  }
</style>
