<script lang="ts">
  import AdminPageSkeleton from '$lib/components/ui/AdminPageSkeleton.svelte'
  import LoadError from '$lib/components/ui/LoadError.svelte'
  import FeaturedWordsView from './FeaturedWordsView.svelte'

  let { data } = $props()
</script>

{#await data.featured_entries}
  <AdminPageSkeleton variant="list" title_width="10rem" rows={8} />
{:then featured_entries}
  <FeaturedWordsView data={{ ...data, featured_entries }} />
{:catch error}
  <div class="wrap"><LoadError {error} label="Couldn’t load featured words." /></div>
{/await}

<style>
  .wrap { max-width: 70rem; margin: 0 auto; padding: 1.5rem 1rem; }
</style>
