<script lang="ts">
  import AdminPageSkeleton from '$lib/components/ui/AdminPageSkeleton.svelte'
  import LoadError from '$lib/components/ui/LoadError.svelte'
  import AnalyticsView from './AnalyticsView.svelte'

  let { data } = $props()

  // Progressive swap: `primary` (light tier) paints first; when the full
  // `secondary` (usage) tier resolves we render from it instead, so the heavy
  // panels fill in below without blocking the top summary.
  let secondary = $state<Awaited<typeof data.secondary> | undefined>(undefined)
  $effect(() => {
    secondary = undefined
    data.secondary?.then((value) => { secondary = value }).catch(() => {
    // Detail tier failed to load — stay on the light `primary` render.
    })
  })
</script>

{#if data.primary}
  {#await data.primary}
    <AdminPageSkeleton variant="panels" title_width="9rem" cards={4} panels={3} />
  {:then primary}
    <AnalyticsView data={{ ...data, analytics: secondary ?? primary }} />
  {:catch error}
    <div class="wrap"><LoadError {error} label="Couldn’t load analytics." /></div>
  {/await}
{/if}

<style>
  .wrap { max-width: 70rem; margin: 0 auto; padding: 1.5rem 1rem; }
</style>
