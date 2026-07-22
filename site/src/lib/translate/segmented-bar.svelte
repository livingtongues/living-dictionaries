<script lang="ts">
  import type { ProgressCounts, TranslateFilter } from './constants'
  import { PROGRESS_CATEGORIES, PROGRESS_CATEGORY_META } from './constants'

  interface Props {
    counts: ProgressCounts
    total: number
    size?: 'mini' | 'full'
    /** When the active filter maps to a segment, the others dim so the focus reads. */
    active_filter?: TranslateFilter
    /** Full bar only: clicking a segment activates its filter. */
    onpick?: (filter: TranslateFilter) => void
  }

  const { counts, total, size = 'full', active_filter, onpick }: Props = $props()

  // Only a filter that maps to a single segment (untranslated/ai/en_changed) focuses the bar;
  // 'all'/'pending' leave every segment at full strength.
  const focused_category = $derived(PROGRESS_CATEGORIES.some(category => PROGRESS_CATEGORY_META[category].filter === active_filter) ? active_filter : null)

  const segments = $derived(PROGRESS_CATEGORIES.map((category) => {
    const meta = PROGRESS_CATEGORY_META[category]
    const value = counts[category]
    return {
      category,
      value,
      meta,
      percent: total ? (value / total) * 100 : 0,
      dimmed: !!focused_category && meta.filter !== focused_category,
    }
  }).filter(segment => segment.value > 0))
</script>

<div class={['bar', size]} role="presentation">
  {#each segments as segment (segment.category)}
    {#if size === 'full' && onpick && segment.meta.filter}
      <button
        type="button"
        class={['segment', { dimmed: segment.dimmed }]}
        style:width="{segment.percent}%"
        style:background={segment.meta.color}
        title="{segment.meta.label}: {segment.value}"
        onclick={() => onpick(segment.meta.filter as TranslateFilter)}>
      </button>
    {:else}
      <div
        class={['segment', { dimmed: segment.dimmed }]}
        style:width="{segment.percent}%"
        style:background={segment.meta.color}
        title="{segment.meta.label}: {segment.value}">
      </div>
    {/if}
  {/each}
</div>

<style>
  .bar {
    display: flex;
    width: 100%;
    overflow: hidden;
    background: color-mix(in srgb, var(--color-secondary) 14%, var(--background));
  }

  .bar.mini {
    height: 6px;
    border-radius: 3px;
    gap: 1px;
  }

  .bar.full {
    height: 16px;
    border-radius: 8px;
    gap: 2px;
  }

  .segment {
    height: 100%;
    border: none;
    padding: 0;
    transition: opacity var(--transition-time, 150ms), filter var(--transition-time, 150ms);
  }

  .segment.dimmed {
    opacity: 0.35;
  }

  button.segment {
    cursor: pointer;
  }

  button.segment:hover {
    filter: brightness(1.08);
  }
</style>
