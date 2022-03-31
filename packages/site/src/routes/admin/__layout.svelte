<script lang="ts">
  import Header from '$lib/components/shell/Header.svelte';
  import AdminGuard from '$lib/components/ui/AdminGuard.svelte';
  import Tab from './_Tab.svelte';
  const tabs = ['users', 'dictionaries'];
</script>

<svelte:head>
  <title>Admin Panel</title>
</svelte:head>

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
    @apply -mb-px flex overflow-x-auto;
  }
</style>
