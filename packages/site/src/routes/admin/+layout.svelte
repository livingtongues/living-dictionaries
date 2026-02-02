<script lang="ts">
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import AdminGuard from '$lib/components/ui/AdminGuard.svelte'
  import { Button } from '$lib/svelte-pieces'
  import Tab from './Tab.svelte'

  let { data, children } = $props()
</script>

<SeoMetaTags title="Admin Panel" />

<Header>Admin Panel</Header>

<AdminGuard>
  <div class="px-3 border-b border-gray-200">
    <nav>
      <Tab link="users" label="users" />
      <Tab link="dictionaries?filter=public" label="public dictionaries" />
      <Tab link="dictionaries?filter=private" label="private dictionaries" />
      <Tab link="dictionaries?filter=other" label="other dictionaries" />
      <Button
        type="button"
        class="ml-auto my-1"
        size="sm"
        form="simple"
        disabled={data.sync?.is_syncing}
        onclick={() => data.sync?.sync_with_notice()}>
        {#if data.sync?.is_syncing}
          Syncing...
        {:else}
          Sync
        {/if}
      </Button>
    </nav>
  </div>

  <div class="p-3">
    {@render children?.()}
  </div>
</AdminGuard>

<style>
  nav {
    @apply -mb-px flex overflow-x-auto;
  }
</style>
