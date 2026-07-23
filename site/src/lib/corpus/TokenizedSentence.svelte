<script lang="ts">
  import type { SentenceTokens } from '$lib/db/schemas/dictionary.types'
  import type { SentenceTiming } from '$lib/media/media-timings'
  import type { TokenKind } from './token-kind'
  import { find_active_token } from '$lib/media/media-timings'
  import { token_kind } from './token-kind'

  interface Props {
    /** `sentences.tokens` (live row value) — falls back to plain text when absent. */
    tokens: SentenceTokens | null | undefined
    /** Orthography code being displayed (from `get_headword`). */
    orthography: string
    /** That orthography's sentence text (token offsets index into it). */
    text: string
    /** Editor affordances: unmatched/ambiguous/ignored tokens become tappable. */
    can_edit?: boolean
    /** Highlight unmatched/ambiguous + distinguish auto vs confirmed (editors). */
    review_mode?: boolean
    /** Karaoke: absolute per-token spans (align 1:1 with the token array). */
    timing?: SentenceTiming
    current_ms?: number
    is_active?: boolean
    /** Token whose popover is open (visual anchor state). */
    selected_index?: number | null
    on_token_tap?: (args: { token_index: number, anchor: HTMLElement }) => void
  }

  const {
    tokens,
    orthography,
    text,
    can_edit = false,
    review_mode = false,
    timing,
    current_ms = 0,
    is_active = false,
    selected_index = null,
    on_token_tap,
  }: Props = $props()

  const list = $derived(tokens?.[orthography] ?? [])
  const can_karaoke = $derived(!!timing && list.length > 0 && list.length === timing.token_spans.length)
  const active_index = $derived(is_active && can_karaoke && timing
    ? find_active_token({ token_spans: timing.token_spans, current_ms })
    : -1)

  const reviewing = $derived(can_edit && review_mode)

  function is_tappable(kind: TokenKind): boolean {
    if (!on_token_tap)
      return false
    if (kind === 'auto' || kind === 'confirmed')
      return true
    if (kind === 'punct')
      return false
    return reviewing
  }

  // Pre-shaped render parts so the template can stay WHITESPACE-TIGHT: any
  // newline between template tags would render as a space between adjacent
  // tokens (wrong for punctuation and no-space scripts).
  interface TokenPart {
    kind: TokenKind
    token: NonNullable<SentenceTokens[string]>[number]
    index: number
    tappable: boolean
  }
  const parts = $derived.by(() => {
    const out: (string | TokenPart)[] = []
    list.forEach((token, index) => {
      const gap_start = index === 0 ? 0 : list[index - 1].end
      if (token.start > gap_start)
        out.push(text.slice(gap_start, token.start))
      const kind = token_kind(token)
      out.push({ kind, token, index, tappable: is_tappable(kind) })
    })
    if (list.length && list[list.length - 1].end < text.length)
      out.push(text.slice(list[list.length - 1].end))
    return out
  })

  function tap(event: MouseEvent, token_index: number) {
    // Don't bubble into the sentence's play/select handler.
    event.stopPropagation()
    on_token_tap?.({ token_index, anchor: event.currentTarget as HTMLElement })
  }
</script>

{#if list.length}{#each parts as part, part_index (part_index)}{#if typeof part === 'string'}{part}{:else if part.tappable}<button
  type="button"
  class="token kind-{part.kind}"
  class:reviewing
  class:selected={selected_index === part.index}
  class:active={part.index === active_index}
  onclick={event => tap(event, part.index)}>{part.token.form}</button>{:else}<span
  class="token kind-{part.kind}"
  class:reviewing
  class:active={part.index === active_index}>{part.token.form}</span>{/if}{/each}{:else}{text}{/if}

<style>
  .token {
    border-radius: 0.25rem;
    padding: 0.05em 0.02em;
    transition: background-color 120ms, color 120ms;
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    cursor: default;
  }

  button.token {
    cursor: pointer;
  }

  /* Matched words: subtle underline for every visitor — dotted while machine-
     suggested, solid once human-confirmed (only distinguishable in review mode). */
  .kind-auto,
  .kind-confirmed {
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, var(--primary) 55%, transparent);
    text-decoration-thickness: 1.5px;
    text-underline-offset: 0.2em;
  }

  .kind-auto.reviewing {
    text-decoration-style: dotted;
  }

  button.kind-auto:hover,
  button.kind-confirmed:hover,
  .token.selected {
    background: color-mix(in srgb, var(--primary) 14%, transparent);
  }

  .kind-unmatched.reviewing {
    background: color-mix(in srgb, #f59e0b 22%, transparent);
  }

  .kind-ambiguous.reviewing {
    background: color-mix(in srgb, #8b5cf6 22%, transparent);
  }

  .kind-ignored.reviewing {
    opacity: 0.55;
    text-decoration: line-through;
    text-decoration-color: color-mix(in srgb, var(--color) 35%, transparent);
  }

  .kind-unmatched.reviewing:hover,
  .kind-ambiguous.reviewing:hover {
    filter: brightness(0.94);
  }

  .token.active {
    background: var(--primary);
    color: var(--on-primary);
    padding: 0.05em 0.12em;
  }
</style>
