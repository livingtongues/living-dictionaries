<script lang="ts">
  import AdminPageSkeleton from '$lib/components/ui/AdminPageSkeleton.svelte'
  import LoadError from '$lib/components/ui/LoadError.svelte'
  import HealthView from './HealthView.svelte'

  let { data } = $props()
</script>

{#if data.analytics}
  {#await data.analytics}
    <AdminPageSkeleton variant="panels" title_width="8rem" cards={4} panels={3} />
  {:then analytics}
    <HealthView data={{ ...data, analytics }} />
  {:catch error}
    <div class="wrap"><LoadError {error} label="Couldn’t load site health." /></div>
  {/await}
{/if}

<style>
  .wrap { max-width: 70rem; margin: 0 auto; padding: 1.5rem 1rem; }
</style>
