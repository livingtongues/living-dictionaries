<script lang="ts">
  import { Button, ResponsiveSlideover, ShowHide } from 'svelte-pieces'
  import SideMenu from './SideMenu.svelte'
  import { page } from '$app/stores'
  import Header from '$lib/components/shell/Header.svelte'
  import './custom-fonts.css'

  export let data
  $: ({ dictionary, is_manager, entries_data } = data)
</script>

<ShowHide let:show let:toggle let:set>
  <Header>
    <div
      slot="left"
      class="font-semibold sm:text-xl overflow-x-auto md:overflow-hidden">
      <a
        class="p-3 hover:text-black hidden md:inline print:hidden"
        href="/">
        <i class="fas fa-home" />
      </a>
      <div class="w-2 hidden md:inline" />

      <button type="button" class="p-3 md:hidden print:p-0" on:click={toggle}>
        <i class="far fa-bars print:hidden" />
        {dictionary.name}
      </button>
      <a class="hover:text-black hidden md:inline" href="/{dictionary.url}">
        {dictionary.name}
      </a>
    </div>
  </Header>

  <div class="flex px-3 print:px-0">
    <ResponsiveSlideover
      side={$page.data.t('page.direction') === 'rtl' ? 'right' : 'left'}
      showWidth="md"
      on_close={() => set(false)}
      open={show}>
      <div
        class="h-full md:h-unset flex flex-col flex-shrink-0 md:top-12 md:sticky md:w-44 lg:w-48 print:hidden">
        <SideMenu {dictionary} is_manager={$is_manager} entry_count={$entries_data?.length} on_close={() => set(false)} />
        <hr class="md:hidden" />
        <Button form="menu" class="text-left !md:hidden" onclick={toggle}>
          <i class="far fa-times fa-lg fa-fw" />
          {$page.data.t('misc.close')}
        </Button>
      </div>
    </ResponsiveSlideover>
    <div class="hidden md:block w-3 flex-shrink-0 print:hidden" />
    <div class="flex-grow">
      <slot />
    </div>
  </div>
</ShowHide>
