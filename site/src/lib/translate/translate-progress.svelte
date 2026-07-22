<script lang="ts">
  import type { ProgressCategory, ProgressCounts, TranslateFilter } from './constants'
  import { get_locale_display_name } from '$lib/i18n/locales'
  import { FILTER_LABELS, PROGRESS_CATEGORY_META } from './constants'
  import SegmentedBar from './segmented-bar.svelte'

  interface Props {
    locale: string
    counts: ProgressCounts
    total: number
    filter: TranslateFilter
    on_pick_filter: (filter: TranslateFilter) => void
  }

  const { locale, counts, total, filter, on_pick_filter }: Props = $props()

  const pending = $derived(counts.ai + counts.en_changed + counts.missing)

  // Left plain chips (broad scopes), then colored legend chips (one per bar segment).
  const plain_chips = $derived<{ filter: TranslateFilter, count: number }[]>([
    { filter: 'all', count: total },
    { filter: 'pending', count: pending },
  ])
  const legend_chips = $derived<{ filter: TranslateFilter, category: ProgressCategory, count: number }[]>([
    { filter: 'missing', category: 'missing', count: counts.missing },
    { filter: 'ai', category: 'ai', count: counts.ai },
    { filter: 'en_changed', category: 'en_changed', count: counts.en_changed },
  ])
</script>

<section class="progress">
  <div class="head">
    <span class="locale">{get_locale_display_name(locale)}</span>
    <span class="reviewed">{counts.reviewed.toLocaleString()} / {total.toLocaleString()} reviewed</span>
  </div>

  <SegmentedBar {counts} {total} size="full" active_filter={filter} onpick={on_pick_filter} />

  <div class="chips">
    {#each plain_chips as chip (chip.filter)}
      <button type="button" class={['chip', { active: filter === chip.filter }]} onclick={() => on_pick_filter(chip.filter)}>
        {FILTER_LABELS[chip.filter]}
        <span class="count">{chip.count.toLocaleString()}</span>
      </button>
    {/each}
    <span class="divider" aria-hidden="true"></span>
    {#each legend_chips as chip (chip.filter)}
      <button type="button" class={['chip legend', { active: filter === chip.filter }]} onclick={() => on_pick_filter(chip.filter)}>
        <span class="dot" style:background={PROGRESS_CATEGORY_META[chip.category].color}></span>
        {FILTER_LABELS[chip.filter]}
        <span class="count">{chip.count.toLocaleString()}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .progress {
    margin-bottom: 1rem;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .locale {
    font-size: 1rem;
    font-weight: 700;
  }

  .reviewed {
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }

  .chips {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.625rem;
  }

  .divider {
    width: 1px;
    align-self: stretch;
    margin: 0.125rem 0.25rem;
    background: var(--border-color);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.3125rem 0.625rem;
    border: 1px solid transparent;
    border-radius: 999px;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
    transition: background var(--transition-time, 150ms), border-color var(--transition-time, 150ms), color var(--transition-time, 150ms);
  }

  .chip:hover {
    background: var(--surface);
  }

  .chip.active {
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
    color: var(--primary);
    border-color: color-mix(in srgb, var(--primary) 40%, transparent);
  }

  .dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 3px;
    flex: 0 0 auto;
  }

  .count {
    font-size: 0.6875rem;
    opacity: 0.85;
  }
</style>
