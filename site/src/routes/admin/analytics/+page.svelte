<script lang="ts">
  import AdminPageSkeleton from '$lib/components/ui/AdminPageSkeleton.svelte'
  import LoadError from '$lib/components/ui/LoadError.svelte'
  import AnalyticsView from './AnalyticsView.svelte'

  let { data } = $props()
</script>

{#if data.analytics}
  {#await data.analytics}
    <AdminPageSkeleton variant="panels" title_width="9rem" cards={4} panels={3} />
  {:then analytics}
    <AnalyticsView data={{ ...data, analytics }} />
  {:catch error}
    <div class="wrap"><LoadError {error} label="Couldn’t load analytics." /></div>
  {/await}
{/if}

<style>
  .wrap { max-width: 70rem; margin: 0 auto; padding: 1.5rem 1rem; }
</style>
