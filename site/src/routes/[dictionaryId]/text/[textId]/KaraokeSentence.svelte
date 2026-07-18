<script lang="ts">
  import type { SentenceTiming } from '$lib/media/media-timings'
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
  import { find_active_token } from '$lib/media/media-timings'
  import { PRIMARY_ORTHOGRAPHY_CODE } from '$lib/db/schemas/shared.types'

  interface Props {
    sentence: DictRowType<'sentences'>
    /** Absolute per-token spans for this sentence (from `build_text_timings`). */
    timing?: SentenceTiming
    /** Fallback display string when there are no timed tokens to render. */
    fallback_text: string
    /** Current playback position in ms — only drives highlight when `is_active`. */
    current_ms?: number
    /** True when this sentence is the one currently playing. */
    is_active?: boolean
  }

  const { sentence, timing, fallback_text, current_ms = 0, is_active = false }: Props = $props()

  // Timings align 1:1 with the default-orthography tokens (schema contract).
  const tokens = $derived(sentence.tokens?.[PRIMARY_ORTHOGRAPHY_CODE] ?? [])
  const can_karaoke = $derived(!!timing && tokens.length > 0 && tokens.length === timing.token_spans.length)

  const active_index = $derived(is_active && timing
    ? find_active_token({ token_spans: timing.token_spans, current_ms })
    : -1)
</script>

{#if can_karaoke && timing}
  {#each tokens as token, index (index)}
    <span class="token" class:active={index === active_index}>{token.form}</span>
  {/each}
{:else}
  {fallback_text}
{/if}

<style>
  .token {
    border-radius: 0.25rem;
    padding: 0.05em 0.02em;
    transition: background-color 120ms, color 120ms;
  }

  .token.active {
    background: var(--primary);
    color: var(--on-primary);
    padding: 0.05em 0.12em;
  }
</style>
