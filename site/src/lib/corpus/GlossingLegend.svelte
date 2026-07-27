<script lang="ts">
  import type { LegendEntry } from './gloss-legend'
  import { page } from '$app/state'
  import { gloss_for_language } from './gloss-legend'

  /**
   * The dictionary's glossing-abbreviations legend, grouped by the optional
   * `category` column. Renders nothing when the dictionary has no legend — most
   * don't, and an empty "Glossing abbreviations" heading is just noise.
   */

  const { dict_db, dictionary, t } = $derived(page.data)

  const language = $derived(dictionary.gloss_languages?.[0] ?? null)
  const entries = $derived([...((dict_db?.glossing_abbreviations.rows ?? []) as unknown as LegendEntry[])]
    .sort((first, second) => first.code.localeCompare(second.code)))

  const groups = $derived.by(() => {
    const by_category: Record<string, LegendEntry[]> = {}
    for (const entry of entries) {
      const key = entry.category?.trim() || ''
      by_category[key] = [...(by_category[key] ?? []), entry]
    }
    // Uncategorised last, everything else alphabetically.
    return Object.entries(by_category).sort(([first], [second]) => {
      if (!first) return 1
      if (!second) return -1
      return first.localeCompare(second)
    })
  })
</script>

{#if entries.length}
  <section class="legend">
    <h4 class="heading">{t('grammar.glossing_legend')}</h4>
    {#each groups as [category, group] (category)}
      {#if category}<div class="category">{category}</div>{/if}
      <dl>
        {#each group as entry (entry.code)}
          <dt>{entry.code}</dt>
          <dd>{gloss_for_language(entry.name, language)}</dd>
        {/each}
      </dl>
    {/each}
  </section>
{/if}

<style>
  .legend {
    margin-top: 1.5rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--color) 3%, var(--background));
  }

  .heading {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0 0 0.625rem;
  }

  .category {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-secondary);
    margin: 0.75rem 0 0.25rem;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.75rem;
    row-gap: 0.25rem;
    margin: 0;
    font-size: 0.875rem;
  }

  dt {
    font-variant-caps: all-small-caps;
    font-feature-settings: 'c2sc', 'smcp';
    letter-spacing: 0.03em;
    font-weight: 700;
    color: var(--color-secondary);
  }

  dd {
    margin: 0;
  }
</style>
