<script lang="ts">
  import type { DictionaryView, IPoint } from '@living-dictionaries/types'
  import { Button, ShowHide } from 'svelte-pieces'
  import { page } from '$app/stores'

  export let my_dictionaries: DictionaryView[] = []
  export let setCurrentDictionary: (dictionary: DictionaryView) => void
</script>

{#if my_dictionaries?.length}
  <div class="flex flex-wrap md:flex-col overflow-y-auto overflow-x-hidden mb-1">
    <ShowHide let:show let:toggle>
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
    </ShowHide>
  </div>
{/if}