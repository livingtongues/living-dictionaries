<script lang="ts">
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import Header from '$lib/components/shell/Header.svelte';
  import AdminGuard from '$lib/components/ui/AdminGuard.svelte';
  import Tab from './Tab.svelte';
  const tabs = ['users', 'dictionaries'];
</script>

<SeoMetaTags title="Admin Panel" />

<Header>Admin Panel</Header>

<AdminGuard>
  <div class="px-3 border-b border-gray-200">
    <nav>
      {#each tabs as tab}
        <Tab link={tab} />
      {/each}
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
