<script lang="ts">
  import IconMdiChevronLeft from '~icons/mdi/chevron-left'
  import IconMdiChevronRight from '~icons/mdi/chevron-right'

  interface Props {
    /** 1-based current page. */
    page: number
    page_size: number
    total: number
    on_change: (page_number: number) => void
    /** Noun for the count label, e.g. "users" → "showing 1–100 of 240 users". */
    noun?: string
  }
  let { page, page_size, total, on_change, noun }: Props = $props()

  const page_count = $derived(Math.max(1, Math.ceil(total / page_size)))
  const clamped_page = $derived(Math.min(Math.max(page, 1), page_count))
  const first = $derived(total === 0 ? 0 : (clamped_page - 1) * page_size + 1)
  const last = $derived(Math.min(clamped_page * page_size, total))

  /** Compact page list: 1 … p-1 p p+1 … N (numbers, with `null` = gap). */
  const items = $derived.by<(number | null)[]>(() => {
    if (page_count <= 7)
      return Array.from({ length: page_count }, (_, i) => i + 1)
    const set = new Set<number>([1, page_count, clamped_page, clamped_page - 1, clamped_page + 1])
    const pages = [...set].filter(candidate => candidate >= 1 && candidate <= page_count).sort((a, b) => a - b)
    const out: (number | null)[] = []
    let previous = 0
    for (const candidate of pages) {
      if (previous && candidate - previous > 1)
        out.push(null)
      out.push(candidate)
      previous = candidate
    }
    return out
  })

  function go(next: number) {
    const target = Math.min(Math.max(next, 1), page_count)
    if (target !== clamped_page)
      on_change(target)
  }
</script>

<div class="pagination">
  <span class="count">
    {#if total === 0}
      No results
    {:else}
      Showing {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}{#if noun}&nbsp;{noun}{/if}
    {/if}
  </span>

  {#if page_count > 1}
    <div class="controls">
      <button type="button" class="page-btn arrow" disabled={clamped_page <= 1} onclick={() => go(clamped_page - 1)} aria-label="Previous page">
        <IconMdiChevronLeft />
      </button>
      {#each items as item, index (item ?? `gap-${index}`)}
        {#if item === null}
          <span class="gap">…</span>
        {:else}
          <button type="button" class={['page-btn', { active: item === clamped_page }]} aria-current={item === clamped_page ? 'page' : undefined} onclick={() => go(item)}>
            {item.toLocaleString()}
          </button>
        {/if}
      {/each}
      <button type="button" class="page-btn arrow" disabled={clamped_page >= page_count} onclick={() => go(clamped_page + 1)} aria-label="Next page">
        <IconMdiChevronRight />
      </button>
    </div>
  {/if}
</div>

<style>
  .pagination {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 0.75rem;
    padding: 0.625rem 0.25rem;
  }
  .count {
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .page-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    height: 2rem;
    padding: 0 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid var(--border-color);
    background: transparent;
    color: var(--color);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s, border-color 0.15s;
  }
  .page-btn:hover:not(:disabled) {
    background: var(--surface);
  }
  .page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .page-btn.arrow {
    padding: 0;
    font-size: 1.125rem;
  }
  .page-btn.active {
    background: var(--primary);
    color: var(--on-primary);
    border-color: transparent;
  }
  .gap {
    padding: 0 0.25rem;
    color: var(--color-secondary);
    user-select: none;
  }
</style>
