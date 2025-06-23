<script lang="ts">
  import { Button } from 'svelte-pieces'
  import Tab from './Tab.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import Footer from '$lib/components/shell/Footer.svelte'
  import AdminGuard from '$lib/components/ui/AdminGuard.svelte'

  export let data
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
        onclick={async () => {
          await data.dictionary_roles.reset()
          await data.users.reset()
        // location.reload()
        }}>Reset cache (after public/private toggle, remove editor)</Button>
    </nav>
  </div>

  <div class="p-3">
    <slot />
  </div>
</AdminGuard>

<Footer />

<style>
  nav {
    --at-apply: -mb-px flex overflow-x-auto;
  }
</style>
