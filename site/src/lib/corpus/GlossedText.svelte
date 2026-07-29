<script lang="ts">
  import type { LegendEntry } from './gloss-legend'
  import { page } from '$app/state'
  import Popover from '$lib/components/ui/Popover.svelte'
  import { build_gloss_splitter, legend_expansion } from './gloss-legend'

  /**
   * A plain-text field whose grammatical codes come alive: any code the
   * dictionary registered in `glossing_abbreviations` renders small-caps and
   * taps open its expansion, exactly as in `InterlinearGloss`. Used by entry
   * `morphology` (Ponca stores `1SG`, `1PL.PST`… there), which is otherwise an
   * opaque string to anyone who hasn't memorised the legend.
   *
   * A dictionary with no legend renders the text verbatim — no wrapper, no
   * behaviour change.
   */

  interface Props {
    text: string
    /** Reader's gloss language for the expansion; defaults to the dictionary's first. */
    language?: string | null
  }

  const { text, language = null }: Props = $props()
  const { dict_db, dictionary, t } = $derived(page.data)

  const legend = $derived((dict_db?.glossing_abbreviations.rows ?? []) as unknown as LegendEntry[])
  const legend_by_code = $derived(new Map(legend.map(entry => [entry.code, entry])))
  const split_gloss = $derived(build_gloss_splitter(legend.map(entry => entry.code)))
  const read_language = $derived(language ?? dictionary?.gloss_languages?.[0] ?? null)

  let open_code = $state<{ code: string, anchor: HTMLElement } | null>(null)
  const expansion = $derived(open_code
    ? legend_expansion({ entry: legend_by_code.get(open_code.code), language: read_language })
    : '')

  // The field around us is often click-to-edit — expanding a code must not also
  // open the edit modal behind the popover.
  function open_expansion({ code, event }: { code: string, event: MouseEvent & { currentTarget: HTMLElement } }) {
    event.stopPropagation()
    open_code = { code, anchor: event.currentTarget }
  }
</script>

{#each split_gloss(text) as piece, index (index)}{#if piece.code}<button
  type="button"
  class="code"
  title={legend_expansion({ entry: legend_by_code.get(piece.code), language: read_language })}
  onclick={event => open_expansion({ code: piece.code, event })}>{piece.text}</button>{:else}{piece.text}{/if}{/each}

{#if open_code}
  <Popover anchor={open_code.anchor} on_close={() => open_code = null} max_width="16rem">
    <div class="expansion">
      <span class="expansion-code">{open_code.code}</span>
      <span class="expansion-name">{expansion || t('grammar.no_legend_entry')}</span>
    </div>
  </Popover>
{/if}

<style>
  .code {
    font-variant-caps: all-small-caps;
    font-feature-settings: 'c2sc', 'smcp';
    letter-spacing: 0.03em;
    font-weight: 600;
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    font-family: inherit;
    color: inherit;
    cursor: help;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
    text-decoration-color: color-mix(in srgb, var(--color) 35%, transparent);
  }

  .code:hover {
    color: var(--primary);
    text-decoration-color: var(--primary);
  }

  .expansion {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem 0.875rem;
  }

  .expansion-code {
    font-variant-caps: all-small-caps;
    font-feature-settings: 'c2sc', 'smcp';
    letter-spacing: 0.03em;
    font-weight: 700;
    color: var(--color-secondary);
    font-size: 0.875rem;
  }

  .expansion-name {
    font-size: 0.9375rem;
  }
</style>
