<script lang="ts">
  import DonutChart from '$lib/charts/DonutChart.svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'

  interface Props {
    /** Facet key (underscored form the search index stores) + translated label + entry count, sorted descending. */
    domains: { key: string, label: string, count: number }[]
    entries_href: string
  }

  const { domains, entries_href }: Props = $props()
  const t = $derived(page.data.t)

  const data = $derived(domains.map(domain => ({ label: domain.label, value: domain.count })))

  // Same `q` JSON blob the entries page's query-param store reads (see entries +page.ts).
  function open_domain(index: number) {
    const key = domains[index]?.key
    if (!key)
      return
    void goto(`${entries_href}?q=${encodeURIComponent(JSON.stringify({ page: 1, query: '', semantic_domains: [key] }))}`)
  }
</script>

<section class="panel">
  <h2>{t('dict_home.top_domains')}</h2>
  <DonutChart {data} nested={false} wrap_labels on_select={open_domain} format={value => value.toLocaleString()} />
</section>

<style>
  .panel {
    background: var(--surface);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
  }

  h2 {
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 0 0 0.75rem;
  }

  /* No pie on mobile — the legend's percentages carry the story on their own. */
  @media (max-width: 640px) {
    .panel :global(.donut svg) {
      display: none;
    }
  }
</style>
