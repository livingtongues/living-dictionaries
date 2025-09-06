<script lang="ts">
  import type { DictionaryView, IPoint } from '@living-dictionaries/types'
  import { Button, ShowHide } from 'svelte-pieces'
  import { page } from '$app/stores'

  export let my_dictionaries: DictionaryView[] = []
  export let setCurrentDictionary: (dictionary: DictionaryView) => void
</script>

  {#if my_dictionaries}
    <div class="flex flex-wrap sm:flex-col overflow-y-auto overflow-x-hidden py-2 mt-2 border-t">
      <ShowHide let:show let:toggle>
        {#each my_dictionaries as dictionary, i}
          {#if show || i < 3}
            <Button
              class="mb-1 lt-sm:mr-1"
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