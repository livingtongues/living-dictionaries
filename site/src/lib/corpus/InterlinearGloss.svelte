<script lang="ts">
  import type { Morpheme, SentenceToken } from '$lib/db/schemas/dictionary.types'
  import type { LegendEntry } from './gloss-legend'
  import { page } from '$app/state'
  import Popover from '$lib/components/ui/Popover.svelte'
  import { build_gloss_splitter, gloss_for_language, legend_expansion } from './gloss-legend'

  interface Props {
    /** The token list for the displayed orthography (`sentences.tokens[code]`). */
    tokens: SentenceToken[]
    /** Reader's gloss language — picks `gloss[language] ?? gloss.default`. */
    language?: string | null
    /** Deep-link a token to its entry when the token carries one. */
    link_entries?: boolean
  }

  const { tokens, language = null, link_entries = true }: Props = $props()
  const { dictionary, dict_db, t } = $derived(page.data)

  const legend = $derived((dict_db?.glossing_abbreviations.rows ?? []) as unknown as LegendEntry[])
  const legend_by_code = $derived(new Map(legend.map(entry => [entry.code, entry])))
  const split_gloss = $derived(build_gloss_splitter(legend.map(entry => entry.code)))

  /** Punctuation carries no analysis — keep it out of the aligned columns. */
  const columns = $derived(tokens.filter(token => token.status !== 'ignored'))

  const has_any_gloss = $derived(columns.some(token =>
    gloss_for_language(token.gloss, language) || token.morphemes?.some(morpheme => gloss_for_language(morpheme.gloss, language))))

  interface Cell {
    form: string
    gloss: string
    /** Leipzig boundary drawn AFTER this cell — it belongs to the NEXT morpheme
     *  in the data, but printing it trailing is what makes `Wí-b-đihą́` over
     *  `1SG>2SG-1SG-lift` read as one segmented word rather than loose pieces. */
    separator: string
    entry_id?: string
  }

  /** A token becomes one cell, or one cell per morpheme when it is segmented. */
  function cells_of(token: SentenceToken): Cell[] {
    const morphemes = token.morphemes ?? []
    if (!morphemes.length)
      return [{ form: token.form, gloss: gloss_for_language(token.gloss, language), separator: '', entry_id: token.entry_id }]
    return morphemes.map((morpheme: Morpheme, index: number) => ({
      form: morpheme.form,
      gloss: gloss_for_language(morpheme.gloss, language),
      separator: index === morphemes.length - 1 ? '' : (morphemes[index + 1].separator ?? '-'),
      entry_id: morpheme.entry_id,
    }))
  }

  let open_code = $state<{ code: string, anchor: HTMLElement } | null>(null)
  const open_expansion = $derived(open_code
    ? legend_expansion({ entry: legend_by_code.get(open_code.code), language })
    : '')

  function entry_href(entry_id: string | undefined): string | null {
    return link_entries && entry_id ? `/${dictionary.url}/entry/${entry_id}` : null
  }
</script>

{#if has_any_gloss}
  <div class="igt">
    {#each columns as token, token_index (token_index)}
      <div class="word">
        {#each cells_of(token) as cell, cell_index (cell_index)}
          <div class="cell">
            <div class="form">{#if entry_href(cell.entry_id)}<a href={entry_href(cell.entry_id)}>{cell.form}</a>{:else}{cell.form}{/if}{#if cell.separator}<span class="sep">{cell.separator}</span>{/if}</div>
            <div class="gloss">{#each split_gloss(cell.gloss) as piece, piece_index (piece_index)}{#if piece.code}<button
              type="button"
              class="code"
              title={legend_expansion({ entry: legend_by_code.get(piece.code), language })}
              onclick={event => open_code = { code: piece.code, anchor: event.currentTarget }}>{piece.text}</button>{:else}{piece.text}{/if}{/each}{#if cell.separator}<span class="sep">{cell.separator}</span>{/if}</div>
          </div>
        {/each}
      </div>
    {/each}
  </div>

  {#if open_code}
    <Popover anchor={open_code.anchor} on_close={() => open_code = null} max_width="16rem">
      <div class="expansion">
        <span class="expansion-code">{open_code.code}</span>
        <span class="expansion-name">{open_expansion || t('grammar.no_legend_entry')}</span>
      </div>
    </Popover>
  {/if}
{/if}

<style>
  /* Each word is an unbreakable block; words wrap like text, morphemes inside a
     word never do — the alignment only means anything if they stay together. */
  .igt {
    display: flex;
    flex-wrap: wrap;
    column-gap: 1.125rem;
    row-gap: 0.5rem;
  }

  .word {
    display: flex;
    align-items: flex-start;
  }

  .cell {
    display: flex;
    flex-direction: column;
  }

  .form {
    font-weight: 500;
    line-height: 1.3;
    white-space: nowrap;
  }

  .form a {
    color: inherit;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
    text-decoration-color: color-mix(in srgb, var(--color) 30%, transparent);
  }

  .form a:hover {
    color: var(--primary);
    text-decoration-color: var(--primary);
  }

  .gloss {
    font-size: 0.8125rem;
    line-height: 1.3;
    color: var(--color-secondary);
    white-space: nowrap;
  }

  .sep {
    opacity: 0.55;
  }

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
