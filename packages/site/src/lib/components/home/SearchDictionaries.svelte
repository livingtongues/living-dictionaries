<script lang="ts">
  import type { DictionaryView, IPoint } from '@living-dictionaries/types'
  import { Button, Modal, ShowHide } from 'svelte-pieces'
  import { page } from '$app/stores'

  export let dictionaries: DictionaryView[] = []
  export let setCurrentDictionary: (dictionary: DictionaryView) => void

  let searchString = ''

  let filteredDictionaries: DictionaryView[] = []
$: filteredDictionaries = dictionaries
    .filter((dictionary) => {
      return Object.keys(dictionary).some((k) => {
        return (
          typeof dictionary[k] === 'string'
          && dictionary[k].toLowerCase().includes(searchString.toLowerCase())
        )
      })
    })
    .reduce((acc, dictionary) => {
      return acc.find(e => e.id === dictionary.id) ? [...acc] : [...acc, dictionary]
    }, [])

    function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 5)
  }
</script>

<ShowHide let:show let:toggle>
  <Button form="filled" class="text-lg! font-semibold!" onclick={toggle}><span class="i-carbon-search text-2xl" /> {$page.data.t('home.find_dictionary')}</Button>
  <div class="border-b mt-2 lt-md:hidden"></div>
  <div class="mb-2"></div>

  {#if show}
    <Modal on:close={toggle} show_x={false}>
        <div class="relative text-xl mb-2">
      <div
        class="absolute inset-y-0 left-0 pl-5 flex items-center
          pointer-events-none text-gray-500">
        <span class="i-carbon-search" />
      </div>
      <input
        type="text"
        use:autofocus
        bind:value={searchString}
        class="form-input w-full pl-10 pr-8 py-1 rounded-lg
          text-gray-900 placeholder-gray-500 border-gray-600! shadow"
        placeholder={$page.data.t('home.find_dictionary')}
         />
        <button type="button" on:click={toggle} class="absolute inset-y-0 right-0 px-4 flex items-center focus:outline-none">
          <span class="i-la-times text-gray-400" />
        </button>
    </div>
      <div class="flex flex-col">
        {#each filteredDictionaries as dictionary, i}
            <Button
              class="mb-1 text-left {i === 0 && 'bg-gray-200'}"
              color="black"
              form="simple"
              onclick={() => setCurrentDictionary(dictionary)}>
              {dictionary?.name}
            </Button>
        {/each}
      </div>
    </Modal>
  {/if}
</ShowHide>

<svelte:window on:keydown={(e) => {
  if (e.key === 'Enter' && filteredDictionaries.length) {
    setCurrentDictionary(filteredDictionaries[0])
  }
}} />
