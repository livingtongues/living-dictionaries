<script lang="ts">
  import { Button, ResponsiveSlideover, ShowHide } from 'svelte-pieces'
  import SideMenu from './SideMenu.svelte'
  import { page } from '$app/stores'
  import Header from '$lib/components/shell/Header.svelte'
  import './custom-fonts.css'

  let { data, children } = $props();
  let { dictionary, is_manager, entries_data } = $derived(data)
  let { loading } = $derived(entries_data)

  const children_render = $derived(children);
</script>

<ShowHide   >
  {#snippet children({ show, toggle, set })}
    <Header>
      {#snippet left()}
        <div
          
          class="font-semibold sm:text-xl overflow-x-auto md:overflow-hidden">
          <a
            class="p-3 hover:text-black hidden md:inline print:hidden"
            href="/">
            <i class="fas fa-home"></i>
          </a>
          <div class="w-2 hidden md:inline"></div>

          <button type="button" class="p-3 md:hidden print:p-0" onclick={toggle}>
            <i class="far fa-bars print:hidden"></i>
            {dictionary.name}
          </button>
          <a class="hover:text-black hidden md:inline" href="/{dictionary.url}">
            {dictionary.name}
          </a>
        </div>
      {/snippet}
    </Header>

    <div class="flex px-3 print:px-0">
      <ResponsiveSlideover
        side={$page.data.t('page.direction') === 'rtl' ? 'right' : 'left'}
        showWidth="md"
        on_close={() => set(false)}
        open={show}>
        <div
          class="h-full md:h-unset flex flex-col flex-shrink-0 md:top-12 md:sticky md:w-44 lg:w-48 print:hidden">
          <SideMenu {dictionary} is_manager={$is_manager} entry_count={Object.keys($entries_data).length} on_close={() => set(false)} loading={$loading} />
          <hr class="md:hidden" />
          <Button form="menu" class="text-left !md:hidden" onclick={toggle}>
            <i class="far fa-times fa-lg fa-fw"></i>
            {$page.data.t('misc.close')}
          </Button>
        </div>
      </ResponsiveSlideover>
      <div class="hidden md:block w-3 flex-shrink-0 print:hidden"></div>
      <div class="flex-grow">
        {@render children_render?.()}
      </div>
    </div>
  {/snippet}
</ShowHide>
