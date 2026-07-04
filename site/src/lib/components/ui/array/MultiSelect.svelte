<script lang="ts">
  import { preventDefault, run, stopPropagation } from 'svelte/legacy'

  import { fly } from 'svelte/transition'
  import { onMount } from 'svelte'
  import type { SelectOption } from './select-options.interface'
  import { clickoutside } from '$lib/utils/clickoutside'
  import IconLaTimes from '~icons/la/times'
  import IconCarbonCaretDown from '~icons/carbon/caret-down'

  interface Props {
    selectedOptions: Record<string, SelectOption>
    options: SelectOption[]
    placeholder?: string
    canWriteIn?: boolean
  }

  let {
    selectedOptions = $bindable(),
    options,
    placeholder = 'Select...',
    canWriteIn = false,
  }: Props = $props()

  let input: HTMLInputElement = $state()
  let inputValue: string = $state()
  let activeOption: SelectOption = $state()
  let showOptions = $state(false)

  onMount(() => {
    input.focus()
  })

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
    const value = inputValue?.trim()
    if (value)
      add({ name: value, value })
  }

  function selectOption(option: SelectOption) {
    if (selectedOptions[option.value])
      remove(option.value)
    else
      add(option)
  }
  let filtered = $derived(options.filter(o =>
    inputValue ? o.name.toLowerCase().includes(inputValue.trim().toLowerCase()) : o,
  ))
  run(() => {
    if ((activeOption && !filtered.includes(activeOption)) || (!activeOption && inputValue))
      [activeOption] = filtered
  })
  run(() => {
    if (!showOptions && inputValue) setShowOptions(true)
  })
</script>

<div
  class="multiselect"
  use:clickoutside
  onclickoutside={() => {
    inputValue = ''
    setShowOptions(false)
  }}>
  <div class="tokens" class:showOptions onclick={() => setShowOptions(true)}>
    {#each Object.values(selectedOptions) as option (option.value)}
      <div class="token">
        <span>{option.name}</span>
        <div
          onclick={stopPropagation(() => remove(option.value))}
          class="remove-token"
          title="Remove {option.name}">
          <IconLaTimes class="icon-inline" />
        </div>
      </div>
    {/each}
    <div class="actions">
      <input
        autocomplete="off"
        bind:value={inputValue}
        bind:this={input}
        onkeydown={handleKeydown}
        onfocus={() => setShowOptions(true)}
        onblur={addWriteInIfApplicable}
        placeholder={Object.keys(selectedOptions).length ? '' : placeholder} />
      <IconCarbonCaretDown class="icon-inline" style="opacity: 0.5" />
    </div>
  </div>

  {#if showOptions}
    <ul
      class="options"
      transition:fly={{ duration: 200, y: 5 }}>
      {#each filtered as option (option.value)}
        <li
          class:selected={selectedOptions[option.value]}
          class:active={activeOption === option}
          onclick={preventDefault(() => selectOption(option))}>
          {option.name}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .multiselect {
    background-color: var(--background);
    border-bottom: 2px dashed color-mix(in srgb, var(--color) 31%, transparent);
    position: relative;
    z-index: 1;
  }
  .multiselect:hover {
    border-bottom-color: color-mix(in srgb, var(--color) 50%, transparent);
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

  .token {
    align-items: center;
    display: flex;
    border-radius: 0.5rem;
    padding: 0.25rem 0.5rem;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1rem;
    background-color: rgb(219 234 254); /* blue-100 */
    color: rgb(30 64 175); /* blue-800 */
    margin-right: 0.5rem;
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .remove-token {
    cursor: pointer;
    justify-content: center;
    align-items: center;
    display: flex;
    background-color: rgb(147 197 253); /* blue-300 */
    border-radius: 9999px;
    height: 1rem;
    width: 1rem;
    margin-left: 0.25rem;
  }

  .remove-token:hover {
    background-color: rgb(96 165 250); /* blue-400 */
  }

  .actions input {
    border-style: none;
    margin: 0;
    padding: 0;
    outline: 2px solid transparent;
    outline-offset: 2px;
    width: 100%;
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
    background-color: var(--background);
    cursor: pointer;
    padding: 0.5rem;
  }
  li:last-child {
    border-bottom-left-radius: 0.2rem;
    border-bottom-right-radius: 0.2rem;
  }
  li:not(.selected):hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 8%);
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
    background-color: color-mix(in srgb, var(--background), var(--color) 12%);
  }
  li.selected.active,
  li.selected:hover {
    background-color: hsl(232, 48%, 50%);
  }
</style>
