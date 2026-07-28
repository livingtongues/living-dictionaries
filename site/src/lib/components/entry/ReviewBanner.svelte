<script lang="ts">
  import type { EntryReview, EntryReviewComparison, SourceCitation } from '$lib/db/schemas/dictionary.types'
  import { page } from '$app/state'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import { get_review_category_label } from '$lib/entry/review-category'
  import { diff_values } from '$lib/entry/review-diff'
  import IconFaSolidExclamationTriangle from '~icons/fa-solid/exclamation-triangle'

  interface Props {
    review: EntryReview
    citations?: SourceCitation[] | null
    /** The entry's current value for a comparison's field — marks which version is already in use. */
    current_value?: (comparison: EntryReviewComparison) => string | undefined
    /** Write the chosen version (only offered when the comparison carries an `apply` target). */
    onapply?: (input: { comparison: EntryReviewComparison, value: string }) => void
    /** Clears the flag ("Resolve"). */
    onresolve: () => void
  }

  const { review, citations = [], current_value, onapply, onresolve }: Props = $props()

  const comparisons = $derived((review.comparisons ?? []).map((comparison) => {
    const diff = diff_values({ a: comparison.a.value, b: comparison.b.value })
    const current = current_value?.(comparison)
    return {
      comparison,
      sides: [
        { ...comparison.a, segments: diff.a, in_use: current === comparison.a.value },
        { ...comparison.b, segments: diff.b, in_use: current === comparison.b.value },
      ],
    }
  }))

  function t(key: string, fallback: string): string {
    return page.data.t?.({ dynamicKey: `entry.${key}`, fallback }) ?? fallback
  }
</script>

<!-- EDITOR-ONLY: the caller renders this only when `can_edit`, and non-editor
     EntryData has `review` stripped upstream — so the public never sees it. -->
<div class="review-banner" role="note">
  <IconFaSolidExclamationTriangle class="review-icon" />
  <div class="review-body">
    <div class="review-head">
      <span class="review-title">{t('needs_review', 'Needs review')}</span>
      {#if review.category}<span class="review-category">{get_review_category_label(review.category)}</span>{/if}
    </div>
    {#if review.note}<div class="review-note">{review.note}</div>{/if}

    <!-- Positional lists: index keys are correct here (a review's comparisons never reorder). -->
    {#each comparisons as { comparison, sides }, comparison_index (comparison_index)}
      <div class="comparison">
        <div class="comparison-field">{comparison.field}</div>
        {#each sides as side, side_index (side_index)}
          <div class="version">
            <div class="version-head">
              <span class="version-label">{side.label}</span>
              {#if side.in_use}
                <span class="in-use">{t('review_in_use', 'In use')}</span>
              {:else if comparison.apply && onapply}
                <HeadlessButton
                  class="btn-outline btn-sm use-this"
                  onclick={() => onapply({ comparison, value: side.value })}>
                  {t('review_use_this', 'Use this')}
                </HeadlessButton>
              {/if}
            </div>
            <div class="version-value">{#each side.segments as segment, segment_index (segment_index)}{#if segment.changed}<mark>{segment.text}</mark>{:else}{segment.text}{/if}{/each}</div>
          </div>
        {/each}
      </div>
    {/each}

    {#if citations.length}
      <details class="source-details">
        <summary>{t('source_details', 'Source details')}</summary>
        <ul>
          {#each citations as citation (`${citation.slug}:${citation.locator ?? ''}`)}
            <li>
              <span>{citation.slug}</span>
              {#if citation.locator}<span class="source-locator"> · {citation.locator}</span>{/if}
            </li>
          {/each}
        </ul>
      </details>
    {/if}
  </div>
  <HeadlessButton class="btn-outline btn-sm review-resolve" onclick={onresolve}>
    {t('resolve_review', 'Resolve')}
  </HeadlessButton>
</div>

<style>
  .review-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
    margin-bottom: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid color-mix(in srgb, #d97706 40%, var(--background));
    background: color-mix(in srgb, #d97706 12%, var(--background));
    color: var(--color);
  }

  .review-banner :global(.review-icon) {
    color: #d97706;
    margin-top: 0.15rem;
    flex-shrink: 0;
  }

  .review-body {
    flex-grow: 1;
    min-width: 0;
  }

  .review-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .review-title {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .review-category {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.05rem 0.4rem;
    border-radius: 0.75rem;
    background: color-mix(in srgb, #d97706 22%, var(--background));
    color: light-dark(#92400e, #fbbf24);
  }

  .review-note {
    font-size: 0.875rem;
    margin-top: 0.15rem;
    white-space: pre-wrap;
    color: color-mix(in srgb, var(--color) 85%, var(--background));
  }

  .comparison {
    margin-top: 0.5rem;
  }

  .comparison-field {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: color-mix(in srgb, var(--color) 55%, var(--background));
  }

  .version + .version {
    margin-top: 0.3rem;
  }

  .version-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 1.25rem;
  }

  .version-label {
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--color) 62%, var(--background));
  }

  .in-use {
    font-size: 0.6875rem;
    padding: 0.05rem 0.35rem;
    border-radius: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--color) 20%, var(--background));
    color: color-mix(in srgb, var(--color) 62%, var(--background));
  }

  .review-banner :global(.use-this) {
    font-size: 0.6875rem;
    padding: 0.05rem 0.45rem;
  }

  .version-value {
    font-size: 0.875rem;
    line-height: 1.4;
  }

  /* Both sides get the SAME highlight — neither version is "wrong" yet, which is
     the question the reviewer is answering. */
  .version-value mark {
    background: light-dark(color-mix(in srgb, #d97706 38%, transparent), color-mix(in srgb, #fbbf24 28%, transparent));
    color: inherit;
    font-weight: 600;
    border-radius: 0.15rem;
    padding: 0.05rem 0.1rem;
  }

  .source-details {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--color) 68%, var(--background));
  }

  .source-details summary {
    cursor: pointer;
    width: fit-content;
  }

  .source-details ul {
    margin: 0.25rem 0 0;
    padding-left: 1.25rem;
  }

  .source-locator {
    font-variant-numeric: tabular-nums;
  }

  .review-banner :global(.review-resolve) {
    flex-shrink: 0;
    align-self: flex-start;
  }

  @media (max-width: 30rem) {
    .review-banner {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
    }

    .review-body,
    .review-banner :global(.review-resolve) {
      grid-column: 2;
    }

    .review-banner :global(.review-resolve) {
      justify-self: start;
      align-self: start;
    }
  }
</style>
