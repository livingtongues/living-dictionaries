<script lang="ts">
  import { dev } from '$app/environment'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import AdminGuard from '$lib/components/ui/AdminGuard.svelte'
  import { delete_db_and_reload } from '$lib/pglite/db'
  import { live_share } from '$lib/pglite/live-share.svelte'
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
      <Button
        type="button"
        class="my-1"
        size="sm"
        form="simple"
        color="red"
        onclick={delete_db_and_reload}>
        Delete Local DB
      </Button>
      {#if dev && live_share.status === 'connected'}
        <a href="https://local.drizzle.studio" target="_blank" class="px-2 py-1 rounded hover:bg-gray-200 text-green-600" title="Open Drizzle Studio">
          <span class="i-mdi-database-outline" />
        </a>
      {/if}
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
