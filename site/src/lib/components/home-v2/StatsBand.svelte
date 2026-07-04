<script lang="ts">
  import type { HomepageStats } from './types'
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { round_stat, stat_step } from './round-stat'

  interface Props {
    stats: HomepageStats
  }

  const { stats }: Props = $props()
  const t = $derived(page.data.t)

  const stat_keys: (keyof HomepageStats)[] = ['dictionaries', 'entries', 'audio', 'photos', 'videos', 'users']

  /** 0→1 animation progress; starts at 1 so SSR (and reduced-motion) shows final values. */
  let progress = $state(1)
  let band_element: HTMLElement = $state()

  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return
    const observer = new IntersectionObserver((observed) => {
      if (!observed.some(entry => entry.isIntersecting))
        return
      observer.disconnect()
      const duration = 1200
      const start = performance.now()
      progress = 0
      const tick = (now: number) => {
        const linear = Math.min((now - start) / duration, 1)
        progress = 1 - (1 - linear) ** 3 // ease-out cubic
        if (linear < 1)
          requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    observer.observe(band_element)
    return () => observer.disconnect()
  })

  function displayed(stat: keyof HomepageStats): string {
    const value = stats[stat]
    if (progress >= 1)
      return round_stat({ value, stat, locale: page.data.locale })
    const step = stat_step(stat)
    const interpolated = Math.floor(value * progress / step) * step
    return `${interpolated.toLocaleString(page.data.locale || 'en')}+`
  }
</script>

<section class="stats-band" bind:this={band_element} aria-label={t('home_v2.stats_heading')}>
  {#each stat_keys as stat (stat)}
    <div class="stat">
      <div class="value">{displayed(stat)}</div>
      <div class="label">{t(`home_v2.stat_${stat}`)}</div>
    </div>
  {/each}
</section>

<style>
  .stats-band {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    max-width: 72rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  @media (min-width: 768px) {
    .stats-band {
      grid-template-columns: repeat(6, 1fr);
      padding: 2.5rem 1.5rem;
    }
  }

  .stat {
    background: var(--surface);
    border-radius: 0.75rem;
    padding: 1rem;
  }

  .value {
    font-size: 1.375rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  @media (min-width: 768px) {
    .value {
      font-size: 1.625rem;
    }
  }

  .label {
    margin-top: 0.125rem;
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }
</style>
