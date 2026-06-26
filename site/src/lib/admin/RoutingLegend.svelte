<script lang="ts">
  import type { TriageCategory } from '$lib/agent/triage/constants'
  import { ADMINS } from '$lib/admins'
  import { TRIAGE_CATEGORIES } from '$lib/agent/triage/constants'
  import { CATEGORY_ROUTING, FALLBACK_ADMIN_EMAIL } from '$lib/agent/triage/routing'

  interface Props {
    /** 'full' = labelled table (examples page); 'compact' = inline chips (panel). */
    variant?: 'full' | 'compact'
  }
  let { variant = 'full' }: Props = $props()

  function admin_name(email: string): string {
    return ADMINS.find(admin => admin.email === email)?.name ?? email
  }

  const rows = TRIAGE_CATEGORIES.map((category: TriageCategory) => ({
    category,
    admin: admin_name(CATEGORY_ROUTING[category]),
  }))
  const fallback_name = admin_name(FALLBACK_ADMIN_EMAIL)
</script>

{#if variant === 'compact'}
  <div class="legend-compact">
    {#each rows as row (row.category)}
      <span class="chip"><b>{row.category}</b> → {row.admin}</span>
    {/each}
    <span class="chip muted">low-confidence + spam → {fallback_name}</span>
  </div>
{:else}
  <table class="legend-table">
    <thead>
      <tr><th>Category</th><th>Routes to</th></tr>
    </thead>
    <tbody>
      {#each rows as row (row.category)}
        <tr><td class="cat">{row.category}</td><td>{row.admin}</td></tr>
      {/each}
      <tr class="fallback"><td class="cat">low-confidence + spam</td><td>{fallback_name} (fallback)</td></tr>
    </tbody>
  </table>
{/if}

<style>
  .legend-compact {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.5rem;
  }
  .chip {
    font-size: 0.7rem;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: var(--background);
    color: var(--color-secondary);
    text-transform: capitalize;
  }
  .chip b {
    color: var(--color);
    font-weight: 600;
  }
  .chip.muted {
    font-style: italic;
  }

  .legend-table {
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  .legend-table th,
  .legend-table td {
    text-align: left;
    padding: 0.35rem 1rem 0.35rem 0;
    border-bottom: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
  }
  .legend-table th {
    color: var(--color-secondary);
    font-weight: 600;
  }
  .legend-table .cat {
    text-transform: capitalize;
    font-weight: 500;
  }
  .legend-table .fallback td {
    color: var(--color-secondary);
    font-style: italic;
  }
</style>
