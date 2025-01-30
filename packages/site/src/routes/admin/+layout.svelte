<script lang="ts">
  import Tab from './Tab.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import AdminGuard from '$lib/components/ui/AdminGuard.svelte'
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
    </nav>
  </div>

  <div class="p-3">
    <slot />
  </div>
</AdminGuard>

<style>
  nav {
    --at-apply: -mb-px flex overflow-x-auto;
  }
</style>
