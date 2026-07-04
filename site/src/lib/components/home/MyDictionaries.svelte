<script lang="ts">
  import type { DictionaryView } from '$lib/types'
  import Button from '$lib/components/ui/Button.svelte'
  import ShowHide from '$lib/components/ui/LegacyShowHide.svelte'
  import { page } from '$app/state'

  interface Props {
    my_dictionaries?: DictionaryView[]
    setCurrentDictionary: (dictionary: DictionaryView) => void
  }

  const { my_dictionaries = [], setCurrentDictionary }: Props = $props()
</script>

{#if my_dictionaries?.length}
  <div class="my-dicts">
    <ShowHide>
      {#snippet children({ show, toggle })}
        {#each my_dictionaries as dictionary, i (dictionary.id)}
          {#if show || i < 3}
            <Button
              class="my-dict-button"
              color="black"
              onclick={() => setCurrentDictionary(dictionary)}>
              {dictionary?.name}
            </Button>
          {/if}
        {/each}
        {#if my_dictionaries.length > 3 && !show}
          <Button
            form="simple"
            onclick={toggle}>
            {page.data.t('home.show_all_my_dictionaries')}
          </Button>
        {/if}
      {/snippet}
    </ShowHide>
  </div>
{/if}

<style>
  .my-dicts {
    display: flex;
    overflow-y: auto;
    overflow-x: hidden;
    margin-bottom: 0.25rem;
  }

  .my-dicts :global(.my-dict-button) {
    margin-bottom: 0.25rem;
  }

  @media (max-width: 767.9px) {
    .my-dicts {
      flex-wrap: wrap;
    }

    .my-dicts :global(.my-dict-button) {
      margin-right: 0.25rem;
    }
  }

  @media (min-width: 768px) {
    .my-dicts {
      flex-direction: column;
      max-height: 70vh;
    }
  }
</style>
