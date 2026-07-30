<script lang="ts">
  import AdminPageSkeleton from '$lib/components/ui/AdminPageSkeleton.svelte'
  import LoadError from '$lib/components/ui/LoadError.svelte'
  import CheckpointBar from '$lib/analytics/CheckpointBar.svelte'
  import HealthView from './HealthView.svelte'

  let { data } = $props()
</script>

{#if data.checkpoint}
  {#await data.checkpoint}
    <AdminPageSkeleton variant="panels" title_width="8rem" cards={4} panels={3} />
  {:then result}
    {#if result.analytics}
      <HealthView data={{ ...data, analytics: result.analytics, checkpoint: result.checkpoint }} />
    {:else}
      <!-- No checkpoint on disk yet: the very first deploy, or the file was pruned.
           Deliberately NOT a compute — the button forks the niced child instead. -->
      <div class="wrap">
        <h1>Site health</h1>
        <p>Nothing to show yet. These dashboards render a checkpoint that a background
          job computes once a day (03:30 Pacific, in a low-priority process). Recompute
          to build one now — it takes a couple of minutes.</p>
        <CheckpointBar checkpoint={result.checkpoint} empty />
      </div>
    {/if}
  {:catch error}
    <div class="wrap"><LoadError {error} label="Couldn’t load site health." /></div>
  {/await}
{/if}

<style>
  .wrap { max-width: 70rem; margin: 0 auto; padding: 1.5rem 1rem; }
  .wrap p { color: var(--color-secondary); max-width: none; }
</style>
