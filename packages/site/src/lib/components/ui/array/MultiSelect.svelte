<script lang="ts">
  import { fly } from 'svelte/transition'
  import { onMount } from 'svelte'
  import { clickoutside } from 'svelte-pieces'
  import type { SelectOption } from './select-options.interface'

  export let selectedOptions: Record<string, SelectOption>
  export let options: SelectOption[]
  export let placeholder = 'Select...'
  export let canWriteIn = false

  let input: HTMLInputElement
  let inputValue: string
  let activeOption: SelectOption
  let showOptions = false

  onMount(() => {
    input.focus()
  })

  $: filtered = options.filter(o =>
    inputValue ? o.name.toLowerCase().includes(inputValue.trim().toLowerCase()) : o,
  )
  $: if ((activeOption && !filtered.includes(activeOption)) || (!activeOption && inputValue))
    [activeOption] = filtered

  $: if (!showOptions && inputValue) setShowOptions(true)

  function add(option: SelectOption) {
    selectedOptions[option.value] = option
    input.focus()
    inputValue = ''
  }

  function remove(value: string) {
    const { [value]: _option, ...restOfOptions } = selectedOptions
    selectedOptions = restOfOptions
  }

  function setShowOptions(show: boolean) {
    showOptions = show
    if (show) input.focus()
    if (!show) activeOption = undefined
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && showOptions) {
      e.stopPropagation()
      inputValue = ''
      setShowOptions(false)
    }
    if (e.key === ' ' && activeOption)
      add(activeOption)
    if (e.key === 'Backspace' && !inputValue)
      remove(Object.keys(selectedOptions).pop())
    if (e.key === 'Enter') {
      e.preventDefault() // keep form from submitting and closing modal
      if (activeOption)
        selectOption(activeOption)
      else
        addWriteInIfApplicable()
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const increment = e.key === 'ArrowUp' ? -1 : 1
      const calcIndex = filtered.indexOf(activeOption) + increment
      activeOption
        = calcIndex < 0
          ? filtered[filtered.length - 1]
          : calcIndex === filtered.length
          ? filtered[0]
          : filtered[calcIndex]
    }
  }

  function addWriteInIfApplicable() {
    if (!canWriteIn) return
    const value = inputValue.trim()
    if (value)
      add({ name: value, value })
  }

  function selectOption(option: SelectOption) {
    if (selectedOptions[option.value])
      remove(option.value)
    else
      add(option)
  }
</script>

<div
  class="multiselect"
  use:clickoutside
  on:clickoutside={() => {
    inputValue = ''
    setShowOptions(false)
  }}>
  <div class="tokens" class:showOptions on:click={() => setShowOptions(true)}>
    {#each Object.values(selectedOptions) as option}
      <div
        class="items-center flex rounded-lg px-2 py-1 whitespace-nowrap
          text-sm font-medium leading-4 bg-blue-100 text-blue-800 mr-2 my-1">
        <span>{option.name}</span>
        <div
          on:click|stopPropagation={() => remove(option.value)}
          class="cursor-pointer justify-center items-center flex
            bg-blue-300 hover:bg-blue-400 rounded-full h-4 w-4 ml-1"
          title="Remove {option.name}">
          <span class="i-la-times" />
        </div>
      </div>
    {/each}
    <div class="actions">
      <input
        class="border-none m-0 p-0 outline-none w-full"
        autocomplete="off"
        bind:value={inputValue}
        bind:this={input}
        on:keydown={handleKeydown}
        on:focus={() => setShowOptions(true)}
        on:blur={addWriteInIfApplicable}
        placeholder={Object.keys(selectedOptions).length ? '' : placeholder} />
      <span class="i-carbon-caret-down opacity-50" />
    </div>
  </div>

  {#if showOptions}
    <ul
      class="options"
      transition:fly={{ duration: 200, y: 5 }}>
      {#each filtered as option}
        <li
          class:selected={selectedOptions[option.value]}
          class:active={activeOption === option}
          on:click|preventDefault={() => selectOption(option)}>
          {option.name}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .multiselect {
    background-color: white;
    border-bottom: 2px dashed #afafaf;
    position: relative;
    z-index: 1;
  }
  .multiselect:hover {
    border-bottom-color: hsl(0, 0%, 50%);
  }

  .tokens {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    position: relative;
  }
  .tokens::after {
    background: none repeat scroll 0 0 transparent;
    bottom: -1px;
    content: '';
    display: block;
    height: 2px;
    left: 50%;
    position: absolute;
    background: navy;
    transition: width 0.3s ease 0s, left 0.3s ease 0s;
    width: 0;
  }
  .tokens.showOptions::after {
    width: 100%;
    left: 0;
  }

  .actions {
    align-items: center;
    display: flex;
    flex: 1;
    min-width: 3rem;
  }

  .options {
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1), 0px -2px 4px rgba(0, 0, 0, 0.1);
    left: 0;
    list-style: none;
    margin-block-end: 0;
    margin-block-start: 0;
    max-height: 53vh;
    overflow: auto;
    padding-inline-start: 0;
    position: absolute;
    top: calc(100% + 1px);
    width: 100%;
  }
  li {
    background-color: white;
    cursor: pointer;
    padding: 0.5rem;
  }
  li:last-child {
    border-bottom-left-radius: 0.2rem;
    border-bottom-right-radius: 0.2rem;
  }
  li:not(.selected):hover {
    background-color: hsl(214, 17%, 92%);
  }
  li.selected {
    background-color: hsl(232, 54%, 41%);
    color: white;
  }
  li.selected:nth-child(even) {
    background-color: hsl(232, 50%, 45%);
    color: white;
  }
  li.active {
    background-color: hsl(214, 17%, 88%);
  }
  li.selected.active,
  li.selected:hover {
    background-color: hsl(232, 48%, 50%);
  }
</style>
