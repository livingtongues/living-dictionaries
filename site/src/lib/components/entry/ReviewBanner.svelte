<script lang="ts">
  import type { EntryReview } from '$lib/db/schemas/dictionary.types'
  import { page } from '$app/state'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import IconFaSolidExclamationTriangle from '~icons/fa-solid/exclamation-triangle'

  interface Props {
    review: EntryReview
    /** Clears the flag ("Resolve"). */
    onresolve: () => void
  }

  const { review, onresolve }: Props = $props()
</script>

<!-- EDITOR-ONLY: the caller renders this only when `can_edit`, and non-editor
     EntryData has `review` stripped upstream — so the public never sees it. -->
<div class="review-banner" role="note">
  <IconFaSolidExclamationTriangle class="review-icon" />
  <div class="review-body">
    <div class="review-head">
      <span class="review-title">{page.data.t?.({ dynamicKey: 'entry.needs_review', fallback: 'Needs review' }) ?? 'Needs review'}</span>
      {#if review.category}<span class="review-category">{review.category}</span>{/if}
    </div>
    {#if review.note}<div class="review-note">{review.note}</div>{/if}
  </div>
  <HeadlessButton class="btn-outline btn-sm review-resolve" onclick={onresolve}>
    {page.data.t?.({ dynamicKey: 'entry.resolve_review', fallback: 'Resolve' }) ?? 'Resolve'}
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

  .review-banner :global(.review-resolve) {
    flex-shrink: 0;
    align-self: center;
  }
</style>
