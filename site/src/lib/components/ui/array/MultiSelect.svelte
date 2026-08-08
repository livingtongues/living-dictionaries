<script lang="ts">
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
  let input_value: string = $state()
  // $state.raw (not $state): active_option holds a whole option object by
  // reference and is only ever swapped wholesale. A deep-proxying $state would
  // make `filtered.includes(active_option)` always false (proxy !== raw target),
  // so the reconciling $effect below would reassign every cycle → infinite loop
  // (effect_update_depth_exceeded — the "parts of speech menu freezes" bug).
  let active_option: SelectOption = $state.raw()
  let show_options = $state(false)

  onMount(() => {
    input.focus()
  })

  function add(option: SelectOption) {
    selectedOptions[option.value] = option
    input.focus()
    input_value = ''
  }

  function remove(value: string) {
    const { [value]: _option, ...rest_of_options } = selectedOptions
    selectedOptions = rest_of_options
  }

  function set_show_options(show: boolean) {
    show_options = show
    if (show) input.focus()
    if (!show) active_option = undefined
  }

  function handle_keydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && show_options) {
      e.stopPropagation()
      input_value = ''
      set_show_options(false)
    }
    if (e.key === ' ' && active_option)
      add(active_option)
    if (e.key === 'Backspace' && !input_value)
      remove(Object.keys(selectedOptions).pop())
    if (e.key === 'Enter') {
      e.preventDefault() // keep form from submitting and closing modal
      if (active_option)
        select_option(active_option)
      else
        add_write_in_if_applicable()
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const increment = e.key === 'ArrowUp' ? -1 : 1
      const calc_index = filtered.indexOf(active_option) + increment
      active_option
        = calc_index < 0
          ? filtered[filtered.length - 1]
          : calc_index === filtered.length
          ? filtered[0]
          : filtered[calc_index]
    }
  }

  function add_write_in_if_applicable() {
    if (!canWriteIn) return
    const value = input_value?.trim()
    if (value)
      add({ name: value, value })
  }

  function select_option(option: SelectOption) {
    if (selectedOptions[option.value])
      remove(option.value)
    else
      add(option)
  }
  let filtered = $derived(options.filter(o =>
    input_value ? o.name.toLowerCase().includes(input_value.trim().toLowerCase()) : o,
  ))
  $effect(() => {
    if ((active_option && !filtered.includes(active_option)) || (!active_option && input_value))
      [active_option] = filtered
  })
  $effect(() => {
    if (!show_options && input_value) set_show_options(true)
  })
</script>

<div
  class="multiselect"
  use:clickoutside
  onclickoutside={() => {
    input_value = ''
    set_show_options(false)
  }}>
  <div class="tokens" class:show_options onclick={() => set_show_options(true)}>
    {#each Object.values(selectedOptions) as option (option.value)}
      <div class="token">
        <span>{option.name}</span>
        <div
          onclick={(e) => { e.stopPropagation(); remove(option.value) }}
          class="remove-token"
          title="Remove {option.name}">
          <IconLaTimes />
        </div>
      </div>
    {/each}
    <div class="actions">
      <input
        autocomplete="off"
        bind:value={input_value}
        bind:this={input}
        onkeydown={handle_keydown}
        onfocus={() => set_show_options(true)}
        onblur={add_write_in_if_applicable}
        placeholder={Object.keys(selectedOptions).length ? '' : placeholder} />
      <IconCarbonCaretDown style="opacity: 0.5" />
    </div>
  </div>

  {#if show_options}
    <ul
      class="options"
      transition:fly={{ duration: 200, y: 5 }}>
      {#each filtered as option (option.value)}
        <li
          class:selected={selectedOptions[option.value]}
          class:active={active_option === option}
          onclick={(e) => { e.preventDefault(); select_option(option) }}>
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
  .tokens.show_options::after {
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
