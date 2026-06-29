<script lang="ts">
  // One Core Web Vital rendered as a Good / Needs-work / Poor threshold track with a
  // dot at the p75 value (the percentile Google grades on) — answering "is this good?"
  // at a glance instead of a wall of p50/p75/p95 numbers. Self-contained: metric
  // metadata (spelled-out name, plain-English help, Google thresholds) lives here, so
  // the panel is `{#each web_vitals as v}<VitalBar vital={v} />`. KEEP IN SYNC across
  // house / living-dictionaries / tutor.

  interface Vital { metric: string, count: number, p50: number | null, p75: number | null, p95: number | null }
  const { vital }: { vital: Vital } = $props()

  // [good ≤, poor >]; value between is "needs improvement". unit 'cls' is unitless.
  const META: Record<string, { name: string, help: string, good: number, poor: number, unit: 'ms' | 'cls' }> = {
    LCP: { name: 'Largest Contentful Paint', help: 'How soon the main content finishes loading', good: 2500, poor: 4000, unit: 'ms' },
    INP: { name: 'Interaction to Next Paint', help: 'How fast the page responds to a tap or click', good: 200, poor: 500, unit: 'ms' },
    CLS: { name: 'Cumulative Layout Shift', help: 'How much the page jumps around while loading', good: 0.1, poor: 0.25, unit: 'cls' },
    FCP: { name: 'First Contentful Paint', help: 'When the first text or image appears', good: 1800, poor: 3000, unit: 'ms' },
    TTFB: { name: 'Time to First Byte', help: 'How quickly the server starts responding', good: 800, poor: 1800, unit: 'ms' },
  }
  const GREEN = '#16a34a'
  const AMBER = '#d97706'
  const RED = '#dc2626'

  const meta = $derived(META[vital.metric])

  function fmt(value: number | null, unit: 'ms' | 'cls'): string {
    if (value === null)
      return '—'
    if (unit === 'cls')
      return value.toFixed(3)
    return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}s` : `${Math.round(value)}ms`
  }

  const verdict = $derived.by(() => {
    if (!meta || vital.p75 === null)
      return { label: '—', color: 'var(--color-secondary)' }
    if (vital.p75 <= meta.good)
      return { label: 'Good', color: GREEN }
    if (vital.p75 > meta.poor)
      return { label: 'Poor', color: RED }
    return { label: 'Needs work', color: AMBER }
  })

  // Dot position on an equal-thirds Good|Needs-work|Poor track (each zone = 33.3%),
  // interpolated within the zone the p75 lands in, clamped so it stays visible.
  const dot_pct = $derived.by(() => {
    if (!meta || vital.p75 === null)
      return 0
    const v = vital.p75
    let raw: number
    if (v <= meta.good)
      raw = (v / meta.good) * (100 / 3)
    else if (v <= meta.poor)
      raw = 100 / 3 + ((v - meta.good) / (meta.poor - meta.good)) * (100 / 3)
    else
      raw = 200 / 3 + Math.min((v - meta.poor) / meta.poor, 1) * (100 / 3)
    return Math.max(1.5, Math.min(98.5, raw))
  })
</script>

<div class="vital">
  {#if meta}
    <div class="head">
      <span class="name">{meta.name} <span class="abbr">{vital.metric}</span></span>
      <span class="value-wrap">
        <b class="value" style:color={verdict.color}>{fmt(vital.p75, meta.unit)}</b>
        <span class="pill" style:color={verdict.color} style:--c={verdict.color}>{verdict.label}</span>
      </span>
    </div>
    <div class="help">{meta.help}</div>

    <div class="track">
      <div class="zones">
        <div class="zone" style:background="rgba(22,163,74,0.22)"></div>
        <div class="zone" style:background="rgba(217,119,6,0.22)"></div>
        <div class="zone" style:background="rgba(220,38,38,0.22)"></div>
      </div>
      <div class="marker-line" style:left={`${dot_pct}%`}></div>
      <div class="marker-dot" style:left={`${dot_pct}%`} style:background={verdict.color}></div>
    </div>
    <div class="zone-labels"><span>Good</span><span>Needs work</span><span>Poor</span></div>

    <div class="caption">
      target ≤ {fmt(meta.good, meta.unit)} · median {fmt(vital.p50, meta.unit)} · slowest 5% {fmt(vital.p95, meta.unit)} · {vital.count.toLocaleString()} samples
    </div>
  {:else}
    <div class="head">
      <span class="name">{vital.metric}</span>
      <b class="value">{fmt(vital.p75, 'ms')}</b>
    </div>
    <div class="caption">median {fmt(vital.p50, 'ms')} · slowest 5% {fmt(vital.p95, 'ms')} · {vital.count.toLocaleString()} samples</div>
  {/if}
</div>

<style>
  .vital {
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 0.75rem 0.85rem;
    background: var(--surface);
  }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
  .name { font-weight: 700; font-size: 0.9rem; }
  .abbr { font-weight: 500; font-size: 0.7rem; color: var(--color-secondary); margin-left: 0.15rem; }
  .value-wrap { display: inline-flex; align-items: baseline; gap: 0.5rem; flex: none; }
  .value { font-size: 1.15rem; font-variant-numeric: tabular-nums; }
  .pill {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c) 14%, transparent);
  }
  .help { font-size: 0.72rem; color: var(--color-secondary); margin: 0.2rem 0 0.6rem; }
  .track { position: relative; height: 12px; margin-bottom: 0.3rem; }
  .zones { position: absolute; inset: 0; display: flex; gap: 2px; border-radius: 6px; overflow: hidden; }
  .zone { flex: 1; }
  .marker-line {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    transform: translateX(-50%);
    background: var(--color);
    opacity: 0.55;
  }
  .marker-dot {
    position: absolute;
    top: -4px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    transform: translateX(-50%);
    border: 2px solid var(--surface);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  }
  .zone-labels { display: flex; justify-content: space-between; font-size: 0.64rem; color: var(--color-secondary); opacity: 0.85; }
  .caption { font-size: 0.7rem; color: var(--color-secondary); margin-top: 0.45rem; font-variant-numeric: tabular-nums; }
</style>
