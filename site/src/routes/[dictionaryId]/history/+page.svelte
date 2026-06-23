<script lang="ts">
  import ChangeHistory from '$lib/components/history/ChangeHistory.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'

  const { data } = $props()
  const { dictionary } = $derived(data)
</script>

<div class="history-page">
  <h3 class="history-heading">History</h3>
  <p class="history-sub">Recent changes across this dictionary — who changed what, and when.</p>
  <ChangeHistory dictionary_id={dictionary.id} feed empty_label="No changes have been recorded yet." />
</div>

<SeoMetaTags
  norobots
  title="History"
  dictionaryName={dictionary.name}
  description="Recent changes to this Living Dictionary." />

<style>
  .history-page {
    max-width: 768px;
    padding: 12px 16px 64px;
  }
  .history-heading {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 8px 0 2px;
  }
  .history-sub {
    color: var(--color-grey-600, #6b7280);
    font-size: 14px;
    margin: 0 0 12px;
  }
</style>
