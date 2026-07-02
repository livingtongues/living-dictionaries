<script lang="ts">
  import { createBubbler, run, stopPropagation } from 'svelte/legacy'

  const bubble = createBubbler()
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  interface Props {
    items?: any[]
    placeholder?: string
    keyField?: string
    labelField?: string
    value?: string
  }

  let {
    items = [],
    placeholder = 'CHANGE',
    keyField = 'key',
    labelField = 'name',
    value = $bindable(''),
  }: Props = $props()

  let search = $state('')
  let active = $state(false)
  let results: { value: string, boldedLabel: string, label: string }[] = $state([])

  const regExpEscape = (s) => {
    return s.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')
  }

  run(() => {
    const matchingItems = items.filter(
      item => search.length && JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
    )
    results = matchingItems.map((item) => {
      const boldedLabel = item[labelField].replace(
        new RegExp(regExpEscape(search.trim()), 'i'),
        '<span style=\'font-weight: 600; color: var(--color)\'>$&</span>',
      )
      return { value: item[keyField], boldedLabel, label: item[labelField] }
    })
  })
  run(() => {
    if (results.length === 1)
      [{ value }] = results
    else
      value = ''
  })
  run(() => {
    if (value.length)
      dispatch('selectedResult', { value })
  })
</script>

<svelte:window onclick={() => (active = false)} />

<div onclick={stopPropagation(bubble('click'))} class="autocomplete">
  <input
    type="search"
    {placeholder}
    onfocus={() => (active = true)}
    bind:value={search} />
  <ul class:hidden={!active}>
    {#each results as result (result)}
      <li
        onclick={() => {
          search = result.label;
          ({ value } = result)
          active = false
        }}>
        {@html result.boldedLabel}
      </li>
    {/each}
  </ul>
</div>

<style>
  .autocomplete {
    position: relative;
    width: 14rem;
  }

  /* base input chrome + focus ring come from the global forms.css element styles */
  input {
    display: block;
    width: 100%;
    font-size: 0.875rem;
    line-height: 1.25rem;
    padding: 0.25rem 0.75rem;
  }

  @media (min-width: 768px) {
    input {
      font-size: 0.75rem;
      line-height: 1.25rem;
    }
  }

  ul {
    border: 1px solid var(--border-color);
    position: absolute;
    width: 100%;
    background-color: var(--background);
    overflow: auto;
    z-index: 10;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); /* shadow-lg */
  }

  ul.hidden {
    display: none;
  }

  li {
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    padding: 0.25rem 0.5rem;
    cursor: pointer;
  }

  li:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
  }
</style>

<!-- Adapted from <a href="https://github.com/elcobvg/svelte-autocomplete/blob/master/src/index.html">svelte-autocomplete</a> -->

<!-- Not implemented ideas from original: -->
<!-- Move through list on:keydown  -->

<!-- Adjust height = results.length > maxItems ? maxItems : results.length
this.refs.list.style.height = `${height * 2.25}rem` -->
