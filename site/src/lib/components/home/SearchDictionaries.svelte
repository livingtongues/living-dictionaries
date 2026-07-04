<script lang="ts">
  import type { DictionaryView } from '$lib/types'
  import Button from '$lib/components/ui/Button.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import IconCarbonSearch from '~icons/carbon/search'
  import IconLaTimes from '~icons/la/times'

  interface Props {
    dictionaries?: DictionaryView[]
    setCurrentDictionary: (dictionary: DictionaryView) => void
  }

  const { dictionaries = [], setCurrentDictionary }: Props = $props()

  let searchString = $state('')

  const filteredDictionaries: DictionaryView[] = $derived(dictionaries
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
    }, []))

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 5)
  }
</script>

<ShowHide>
  {#snippet children({ show, toggle })}
    <Button form="filled" class="find-button" onclick={toggle}><IconCarbonSearch class="icon-inline" style="font-size: 1.5rem" /> {page.data.t('home.find_dictionary')}</Button>
    <div class="search-divider"></div>
    <div style="margin-bottom: 0.5rem"></div>

    {#if show}
      <Modal on_close={toggle} show_x={false}>
        <div class="search-box">
          <div class="search-icon">
            <IconCarbonSearch class="icon-inline" />
          </div>
          <input
            type="text"
            use:autofocus
            bind:value={searchString}
            class="dark-border"
            placeholder={page.data.t('home.find_dictionary')} />
          <button type="button" onclick={toggle} class="clear-button">
            <IconLaTimes class="icon-inline" style="color: color-mix(in srgb, var(--color) 45%, var(--background))" />
          </button>
        </div>
        <div class="results">
          {#each filteredDictionaries as dictionary, i (dictionary.id)}
            <Button
              class="result-button {i === 0 ? 'first-result' : ''}"
              color="black"
              form="simple"
              onclick={() => setCurrentDictionary(dictionary)}>
              {dictionary?.name}
            </Button>
          {/each}
        </div>
      </Modal>
    {/if}
  {/snippet}
</ShowHide>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Enter' && filteredDictionaries.length) {
      setCurrentDictionary(filteredDictionaries[0])
    }
  }} />

<style>
  :global(.find-button) {
    font-size: 1.125rem !important;
    line-height: 1.75rem !important;
    font-weight: 600 !important;
  }

  .search-divider {
    border-bottom: 1px solid var(--border-color);
    margin-top: 0.5rem;
  }

  @media (max-width: 767.9px) {
    .search-divider {
      display: none;
    }
  }

  .search-box {
    position: relative;
    font-size: 1.25rem;
    line-height: 1.75rem;
    margin-bottom: 0.5rem;
  }

  .search-icon {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    padding-left: 1.25rem;
    display: flex;
    align-items: center;
    pointer-events: none;
    color: var(--color-secondary); /* ≈ gray-500 */
  }

  /* placeholder color comes from the forms preflight (gray-500) */
  .search-box input {
    width: 100%;
    padding: 0.25rem 2rem 0.25rem 2.5rem;
    border-radius: 0.5rem;
    color: var(--color);
    --un-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); /* shadow */
    box-shadow: var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow);
  }

  .search-box input.dark-border {
    border-color: color-mix(in srgb, var(--background), var(--color) 75%) !important; /* ≈ gray-600, was border-gray-600! */
  }

  .clear-button {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    padding: 0 1rem;
    display: flex;
    align-items: center;
  }

  .clear-button:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
  }

  .results {
    display: flex;
    flex-direction: column;
  }

  .results :global(.result-button) {
    margin-bottom: 0.25rem;
    text-align: left;
  }

  .results :global(.first-result) {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
  }
</style>
