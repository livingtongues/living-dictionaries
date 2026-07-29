<script lang="ts">
  import type { LegendEntry } from './gloss-legend'
  import { page } from '$app/state'
  import GlossCodePopover from './GlossCodePopover.svelte'
  import { build_gloss_catalog } from './gloss-catalog'

  /**
   * A plain-text field whose grammatical codes come alive: any code the
   * dictionary registered in `glossing_abbreviations` — or any standard Leipzig
   * abbreviation — renders small-caps and taps open its expansion, exactly as in
   * `InterlinearGloss`. Used by entry `morphology` (Ponca stores `1SG`,
   * `1PL.PST` there), which is otherwise an opaque string to anyone who hasn't
   * memorised the legend.
   *
   * Free-text field rules apply (see `gloss-catalog`): standard codes need to
   * stand as whole tokens, and the one-character ones (`A`, `S`, `3`) are left
   * alone entirely — plenty of dictionaries write sentences in these fields.
   */

  interface Props {
    text: string
    /** Reader's gloss language for the expansion; defaults to the dictionary's first. */
    language?: string | null
  }

  const { text, language = null }: Props = $props()
  const { dict_db, dictionary, t } = $derived(page.data)

  const legend = $derived((dict_db?.glossing_abbreviations.rows ?? []) as unknown as LegendEntry[])
  const read_language = $derived(language ?? dictionary?.gloss_languages?.[0] ?? null)
  const catalog = $derived(build_gloss_catalog({ legend, language: read_language, t }))

  let open_code = $state<{ code: string, anchor: HTMLElement } | null>(null)

  // The field around us is often click-to-edit — expanding a code must not also
  // open the edit modal behind the popover.
  function open_expansion({ code, event }: { code: string, event: MouseEvent & { currentTarget: HTMLElement } }) {
    event.stopPropagation()
    open_code = { code, anchor: event.currentTarget }
  }
</script>

{#each catalog.split_field(text) as piece, index (index)}{#if piece.code}<button
  type="button"
  class="code"
  title={catalog.expand(piece.code)}
  onclick={event => open_expansion({ code: piece.code, event })}>{piece.text}</button>{:else}{piece.text}{/if}{/each}

{#if open_code}
  <GlossCodePopover
    code={open_code.code}
    expansion={catalog.expand(open_code.code)}
    anchor={open_code.anchor}
    on_close={() => open_code = null} />
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
</style>
