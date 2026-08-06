<script lang="ts">
  import type { LegendEntry } from './gloss-legend'
  import { page } from '$app/state'
  import { gloss_for_language } from './gloss-legend'

  /**
   * The dictionary's glossing-abbreviations legend, grouped by the optional
   * `category` column, plus a collapsed roll of the STANDARD Leipzig codes the
   * page actually uses (localized — curated rows stay dictionary data). Renders
   * nothing when both are empty — most dictionaries have neither, and an empty
   * "Glossing abbreviations" heading is just noise.
   */

  interface Props {
    /** Standard codes used on the page (from `catalog.standard_codes_used`). */
    standard_codes?: readonly string[]
    /** `catalog.expand` — localizes standard codes + curated restatements. */
    expand?: ((code: string) => string) | null
  }

  const { standard_codes = [], expand = null }: Props = $props()

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

{#if entries.length || standard_codes.length}
  <section class="legend">
    <h4 class="heading">{t('grammar.glossing_legend')}</h4>
    {#each groups as [category, group] (category)}
      {#if category}<div class="category">{category}</div>{/if}
      <dl>
        {#each group as entry (entry.code)}
          <dt>{entry.code}</dt>
          <dd>{expand?.(entry.code) || gloss_for_language(entry.name, language)}</dd>
        {/each}
      </dl>
    {/each}
    {#if standard_codes.length}
      <details class="standard" class:solo={!entries.length}>
        <summary>{t('grammar.standard_abbreviations')} ({standard_codes.length})</summary>
        <dl>
          {#each standard_codes as code (code)}
            <dt>{code}</dt>
            <dd>{expand?.(code) || ''}</dd>
          {/each}
        </dl>
      </details>
    {/if}
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

  .standard {
    margin-top: 0.875rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color);
  }

  .standard.solo {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }

  .standard summary {
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-secondary);
    user-select: none;
  }

  .standard summary:hover {
    color: var(--color);
  }

  .standard dl {
    margin-top: 0.5rem;
  }
</style>
