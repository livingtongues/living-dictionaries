<script lang="ts" module>
  export interface DictHomeStats {
    entries: number
    with_audio: number
    with_photos: number
    with_video: number
    speakers: number
  }
</script>

<script lang="ts">
  import { page } from '$app/state'

  interface Props {
    /** null = local index not ready yet — tiles pulse until values arrive, then count up. */
    stats: DictHomeStats | null
  }

  const { stats }: Props = $props()
  const t = $derived(page.data.t)

  // entries + with_audio always render (placeholders while stats stream in); the
  // rest only join once they have a nonzero value — no "0 with video" tiles.
  const base_tiles = [
    { key: 'entries', label_key: 'dict_home.stat_entries' },
    { key: 'with_audio', label_key: 'dict_home.stat_with_audio' },
  ] as const
  const extra_tiles = [
    { key: 'with_photos', label_key: 'dict_home.stat_with_photos' },
    { key: 'with_video', label_key: 'dict_home.stat_with_video' },
    { key: 'speakers', label_key: 'dict_home.stat_speakers' },
  ] as const
  const tiles = $derived([
    ...base_tiles,
    ...extra_tiles.filter(tile => (stats?.[tile.key] ?? 0) > 0),
  ])

  /** 0→1 count-up progress, kicked off the moment stats arrive. */
  let progress = $state(0)
  let animated = false
  $effect(() => {
    if (!stats || animated)
      return
    animated = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      progress = 1
      return
    }
    const duration = 900
    const start = performance.now()
    const tick = (now: number) => {
      const linear = Math.min((now - start) / duration, 1)
      progress = 1 - (1 - linear) ** 3 // ease-out cubic
      if (linear < 1)
        requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  function displayed(key: keyof DictHomeStats): string {
    const value = stats?.[key] ?? 0
    return Math.floor(value * progress).toLocaleString(page.data.locale || 'en')
  }
</script>

<section class="stats" aria-label={t('dict_home.stat_entries')}>
  {#each tiles as tile (tile.key)}
    <div class="stat">
      {#if stats}
        <div class="value">{displayed(tile.key)}</div>
      {:else}
        <div class="value placeholder" aria-hidden="true"></div>
      {/if}
      <div class="label">{t(tile.label_key)}</div>
    </div>
  {/each}
</section>

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
    gap: 0.75rem;
  }

  .stat {
    background: var(--surface);
    border-radius: 0.75rem;
    padding: 0.875rem 1rem;
  }

  .value {
    font-size: 1.375rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    line-height: 1.3;
  }

  .placeholder {
    width: 3.5rem;
    height: 1.25rem;
    margin: 0.25rem 0;
    border-radius: 0.375rem;
    background: color-mix(in srgb, var(--color) 12%, transparent);
    animation: pulse 1.6s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  .label {
    margin-top: 0.125rem;
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }
</style>
