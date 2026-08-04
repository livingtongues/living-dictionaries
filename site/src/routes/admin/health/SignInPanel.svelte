<script lang="ts">
  import type { SignInHealth } from '$lib/db/server/log-analytics'
  import ComboChart from '$lib/charts/ComboChart.svelte'
  import { USERS_COLOR } from '$lib/analytics/dashboard-format'
  import { format_number } from '$lib/constants'
  import { format_relative_time } from '$lib/utils/format-relative-time'

  /**
   * SIGN-IN HEALTH — the panel that counts something that STOPPED happening.
   *
   * Google sign-in was dead for thirty days (2026-07-04 → 2026-08-02) carrying
   * 83% of all logins, and every other panel on this page stayed green the whole
   * time, because a third-party script that fails to load produces FEWER rows,
   * not more. Aggregate, thresholded, silent when healthy — see
   * `build_sign_in_health` for the alarm rule and `sign-in-alarm-cron.ts` for the
   * ping that doesn't wait for anyone to open this page.
   */
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
  const flatlined = $derived(sign_in.methods.filter(method => method.flatlined))
</script>

<section class="panel">
  <h2>Sign-in <span class="hint">logins per method · last complete day ({sign_in.day})</span></h2>
  {#if sign_in.methods.length}
    <p class="verdict" class:ok={!flatlined.length} class:danger={flatlined.length > 0}>
      {format_number(sign_in.logins)} login{sign_in.logins === 1 ? '' : 's'}
      <span class="hint">· {sign_in.methods.map(method => `${format_number(method.logins)} ${method.method}`).join(' · ')} · {format_number(sign_in.new_accounts)} new account{sign_in.new_accounts === 1 ? '' : 's'}</span>
    </p>
    {#each flatlined as method (method.method)}
      <p class="alarm">
        ⚠️ <b>{method.method}</b> produced 0 logins on {sign_in.day}, after averaging {method.daily_average_before}/day the week before
        ({method.active_days_before} of the previous 7 days had logins).
        {#if method.last_login_at}<span>Last login {format_relative_time(method.last_login_at)}.</span>{/if}
        A sign-in method that stops working produces <em>fewer</em> log rows, not errors — no other panel here will notice.
      </p>
    {/each}
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
  .verdict.ok { color: var(--success, #16a34a); }
  .verdict.danger { color: var(--danger); }
  .alarm {
    color: var(--danger);
    font-size: 0.8125rem;
    line-height: 1.45;
    margin: 0.25rem 0 0.9rem;
  }
  .muted {
    color: var(--color-secondary);
    font-size: 0.875rem;
    margin: 0;
  }
</style>
