<script lang="ts">
  import type { DictionaryView } from '@living-dictionaries/types'
  import { page } from '$app/stores'
  import { Button, ShowHide } from '$lib/svelte-pieces'

  interface Props {
    my_dictionaries?: DictionaryView[]
    setCurrentDictionary: (dictionary: DictionaryView) => void
  }

  let { my_dictionaries = [], setCurrentDictionary }: Props = $props()
</script>

{#if my_dictionaries?.length}
  <div class="flex lt-md:flex-wrap md:flex-col overflow-y-auto overflow-x-hidden mb-1 md:max-h-70vh">
    <ShowHide>
      {#snippet children({ show, toggle })}
        {#each my_dictionaries as dictionary, i}
          {#if show || i < 3}
            <Button
              class="mb-1 lt-md:mr-1"
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
            {$page.data.t('home.show_all_my_dictionaries')}
          </Button>
        {/if}
      {/snippet}
    </ShowHide>
  </div>
{/if}
