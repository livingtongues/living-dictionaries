<script lang="ts">
  import type { EntryReview } from '$lib/db/schemas/dictionary.types'
  import { page } from '$app/state'
  import { get_review_category_label } from '$lib/entry/review-category'
  import IconFaSolidExclamationTriangle from '~icons/fa-solid/exclamation-triangle'

  interface Props {
    review: EntryReview
  }

  const { review }: Props = $props()

  const label = $derived([
    page.data.t?.({ dynamicKey: 'entry.needs_review', fallback: 'Needs review' }) ?? 'Needs review',
    review.category ? get_review_category_label(review.category) : '',
  ].filter(Boolean).join(' · '))
</script>

<!-- EDITOR-ONLY: `EntryData.main.review` is stripped upstream for non-editors,
     so this can only ever render for someone with edit rights. -->
<span class="review-indicator" title={label} aria-label={label}>
  <IconFaSolidExclamationTriangle />
</span>

<style>
  .review-indicator {
    display: inline-flex;
    align-items: center;
    color: #d97706;
    font-size: 0.7em;
    margin-inline-start: 0.4em;
    vertical-align: 0.15em;
  }
</style>
