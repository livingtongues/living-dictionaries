<script lang="ts">
  import ChangeHistory from '$lib/components/history/ChangeHistory.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { page } from '$app/state'

  const { data } = $props()
  const { dictionary } = $derived(data)
</script>

<div class="history-page">
  <h3 class="history-heading">{page.data.t('history.history')}</h3>
  <p class="history-sub">Recent changes across this dictionary — who changed what, and when.</p>
  <ChangeHistory dictionary_id={dictionary.id} feed empty_label="No changes have been recorded yet." />
</div>

<SeoMetaTags
  norobots
  title={page.data.t('history.history')}
  dictionaryName={dictionary.name}
  description="Recent changes to this Living Dictionary." />

<style>
  .history-page {
    max-width: 768px;
    padding-bottom: 3rem;
  }
  .history-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin: 0 0 0.25rem;
  }
  .history-sub {
    color: var(--color-secondary);
    font-size: 0.875rem;
    margin: 0 0 0.75rem;
  }
</style>
