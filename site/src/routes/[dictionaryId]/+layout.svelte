<script lang="ts">
  import SideMenu from './SideMenu.svelte'
  import { Button, ResponsiveSlideover, ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/stores'
  import Header from '$lib/components/shell/Header.svelte'
  import { track } from '$lib/debug/remote-log'
  import { DICTIONARY_OPENED } from '$lib/debug/log-events'
  import './custom-fonts.css'

  const { data, children } = $props()
  const { dictionary, is_manager, entries_data } = $derived(data)
  const { loading } = $derived(entries_data)

  const children_render = $derived(children)

  // One `dictionary_opened` per dict the user enters (re-fires when navigating to
  // a different dictionary, since the id in the effect changes). Untracked props
  // keep it keyed solely on the id so unrelated catalog edits don't re-emit.
  let last_opened_dict_id = ''
  $effect(() => {
    const { id } = dictionary
    if (id && id !== last_opened_dict_id) {
      last_opened_dict_id = id
      track({ event: DICTIONARY_OPENED, props: { dictionary_id: id, public: dictionary.public } })
    }
  })
</script>

<ShowHide>
  {#snippet children({ show, toggle, set })}
    <Header>
      {#snippet left()}
        <div class="brand">
          <a
            class="home-link"
            href="/">
            <i class="fas fa-home"></i>
          </a>
          <div class="home-gap"></div>

          <button type="button" class="menu-button" onclick={toggle}>
            <i class="far fa-bars print-hidden"></i>
            {dictionary.name}
          </button>
          <a class="dict-link" href="/{dictionary.url}">
            {dictionary.name}
          </a>
        </div>
      {/snippet}
    </Header>

    <div class="page-row">
      <ResponsiveSlideover
        side={$page.data.t('page.direction') === 'rtl' ? 'right' : 'left'}
        showWidth="md"
        on_close={() => set(false)}
        open={show}>
        <div class="side-panel">
          <SideMenu {dictionary} is_manager={is_manager} entry_count={Object.keys($entries_data).length} on_close={() => set(false)} loading={$loading} />
          <hr />
          <Button form="menu" class="side-close-button" onclick={toggle}>
            <i class="far fa-times fa-lg fa-fw"></i>
            {$page.data.t('misc.close')}
          </Button>
        </div>
      </ResponsiveSlideover>
      <div class="side-gap"></div>
      <div style="flex-grow: 1">
        {@render children_render?.()}
      </div>
    </div>
  {/snippet}
</ShowHide>

<style>
  .brand {
    font-weight: 600;
    overflow-x: auto;
  }

  @media (min-width: 640px) {
    .brand {
      font-size: 1.25rem;
      line-height: 1.75rem;
    }
  }

  .home-link {
    padding: 0.75rem;
    display: none;
  }

  .home-link:hover,
  .dict-link:hover {
    color: #000;
  }

  .home-gap {
    width: 0.5rem;
    display: none;
  }

  .menu-button {
    padding: 0.75rem;
  }

  .dict-link {
    display: none;
  }

  @media (min-width: 768px) {
    .brand {
      overflow: hidden;
    }

    .home-link,
    .home-gap,
    .dict-link {
      display: inline;
    }

    .menu-button {
      display: none;
    }
  }

  .page-row {
    display: flex;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .side-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .side-gap {
    display: none;
    width: 0.75rem;
    flex-shrink: 0;
  }

  @media (min-width: 768px) {
    .side-panel {
      height: unset;
      top: 3rem;
      position: sticky;
      width: 11rem;
    }

    .side-panel hr {
      display: none;
    }

    .side-panel :global(.side-close-button) {
      display: none !important;
    }

    .side-gap {
      display: block;
    }
  }

  @media (min-width: 1024px) {
    .side-panel {
      width: 12rem;
    }
  }

  .side-panel :global(.side-close-button) {
    text-align: left;
  }

  @media print {
    .home-link,
    .print-hidden {
      display: none;
    }

    .menu-button {
      padding: 0;
    }

    .page-row {
      padding-left: 0;
      padding-right: 0;
    }

    .side-panel,
    .side-gap {
      display: none;
    }
  }
</style>
