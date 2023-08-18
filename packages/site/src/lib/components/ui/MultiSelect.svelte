<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';

  export let value: string[] = [];
  export let placeholder = '';

  $: calculatedPlaceholder = value?.length ? '' : placeholder;

  type Option = {
      value: string;
      name: string;
  };

  let input: HTMLInputElement;
  let inputValue: string;
  let options: Option[] = [];
  let activeOption: Option;
  let showOptions = false;
  let selected: Record<string, Option> = {};
  let inited = false;
  let selectSlot: HTMLSelectElement;

  onMount(() => {
    selectSlot.querySelectorAll('option').forEach((option) => {
      if (option.selected && option.value && !value.includes(option.value)) value = [...value, option.value];
      options = [...options, { value: option.value, name: option.textContent }];
    });
    if (value) {
      let newSelected = {}
      for (const option of options) {
        if (value.includes(option.value)) {
          newSelected[option.value] = option
        }
      }
      selected = newSelected
    }
    inited = true;
  });

  $: if (inited) value = Object.values(selected).map((option) => option.value);
  $: filtered = options.filter((o) =>
    inputValue ? o.name.toLowerCase().includes(inputValue.toLowerCase()) : o
  );
  $: if ((activeOption && !filtered.includes(activeOption)) || (!activeOption && inputValue))
    activeOption = filtered[0];

  function add(option: Option) {
    inputValue = '';
    selected[option.value] = option;
  }

  function remove(value: string) {
    const { [value]: option, ...restOfOptions } = selected;
    selected = restOfOptions;
  }

  function setShowOptions(show: boolean) {
    showOptions = show;
    if (show) input.focus();
    if (!show) activeOption = undefined;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      Object.keys(selected).includes(activeOption.value)
        ? remove(activeOption.value)
        : add(activeOption);
      inputValue = '';
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const increment = e.key === 'ArrowUp' ? -1 : 1;
      const calcIndex = filtered.indexOf(activeOption) + increment;
      activeOption =
        calcIndex < 0
          ? filtered[filtered.length - 1]
          : calcIndex === filtered.length
          ? filtered[0]
          : filtered[calcIndex];
    }
  }

  function selectOption(option: Option) {
    if (selected[option.value]) {
      remove(option.value);
    } else {
      add(option);
      input.focus();
    }
  }
</script>

<div class="multiselect">
  <div class="tokens" class:showOptions on:click={() => setShowOptions(true)}>
    {#each Object.values(selected) as option}
      <div
        class="items-center flex rounded-lg px-2 py-1 whitespace-nowrap
        text-sm font-medium leading-4 bg-blue-100 text-blue-800 mr-2 my-1">
        <span>{option.name}</span>
          <div on:click|stopPropagation={() => remove(option.value)}
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
          on:blur={() => setShowOptions(false)}
          placeholder={calculatedPlaceholder} />
          <span class="i-carbon-caret-down opacity-50" />
    </div>
  </div>

  <select bind:this={selectSlot} multiple class="hidden">
    <slot />
  </select>

  {#if showOptions}
    <ul
      class="options"
      transition:fly={{ duration: 200, y: 5 }}>
      {#each filtered as option}
        <li
          class:selected={selected[option.value]}
          class:active={activeOption === option}
          on:click={() => selectOption(option)}>
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
  .multiselect:not(.readonly):hover {
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
