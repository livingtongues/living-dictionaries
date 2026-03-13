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
      <a
        href="/admin/sync"
        class="ml-auto flex items-center p-2 text-lg"
        title="Sync Dashboard">
        {#if data.sync?.is_syncing}
          <span class="i-mdi-loading animate-spin text-blue-600"></span>
        {:else if data.sync?.last_sync_result?.success}
          <span class="i-mdi-cloud-check text-green-600"></span>
        {:else if data.sync?.last_sync_result && !data.sync.last_sync_result.success}
          <span class="i-mdi-cloud-alert text-red-600"></span>
        {:else}
          <span class="i-mdi-cloud-outline text-gray-500"></span>
        {/if}
      </a>
      <Button
        size="sm"
        form="simple"
        color="red"
        onclick={delete_db_and_reload}>
        Reset Local
      </Button>
      {#if dev && live_share.status === 'connected'}
        <Button
          size="sm"
          form="simple"
          class="flex items-center !text-base"
          color="green"
          href="https://local.drizzle.studio"
          title="Open Drizzle Studio"
          target="_blank">
          <span class="i-mdi-database-outline" />
        </Button>
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
