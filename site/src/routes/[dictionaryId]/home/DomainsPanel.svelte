<script lang="ts">
  import IconFa6SolidUserShield from '~icons/fa6-solid/user-shield'

  interface Props {
    /** Translated label → entry count, already sorted descending. */
    domains: { label: string, count: number }[]
  }

  const { domains }: Props = $props()
  const max = $derived(domains[0]?.count ?? 1)
</script>

<!-- Admin-level-3 preview (see the shield) — goes public once the concept is fine-tuned. -->
<section class="panel">
  <h2>
    Top semantic domains
    <IconFa6SolidUserShield class="icon-inline" style="font-size: 0.75rem; opacity: 0.5" />
  </h2>
  <div class="bars">
    {#each domains as domain (domain.label)}
      <div class="row">
        <span class="label">{domain.label}</span>
        <div class="track">
          <div class="bar" style:width="{Math.max(domain.count / max * 100, 2)}%"></div>
        </div>
        <span class="count">{domain.count.toLocaleString()}</span>
      </div>
    {/each}
  </div>
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
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .bars {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(6rem, 11rem) 1fr 3.5rem;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.8125rem;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-secondary);
  }

  .track {
    height: 0.5rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color) 8%, transparent);
    overflow: hidden;
  }

  .bar {
    height: 100%;
    border-radius: 9999px;
    background: var(--primary);
  }

  .count {
    text-align: end;
    font-variant-numeric: tabular-nums;
    color: var(--color-secondary);
  }
</style>
