<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let items: any[] = [];
  export let placeholder = 'CHANGE';
  export let keyField = 'key';
  export let labelField = 'name';
  export let value = '';

  let search = '';
  let active = false;
  let results: { value: string; boldedLabel: string; label: string }[] = [];

  $: {
    const matchingItems = items.filter(
      (item) => search.length && JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
    );
    results = matchingItems.map((item) => {
      const boldedLabel = item[labelField].replace(
        RegExp(regExpEscape(search.trim()), 'i'),
        '<span class=\'font-semibold text-gray-900\'>$&</span>'
      );
      return { value: item[keyField], boldedLabel, label: item[labelField] };
    });
  }

  const regExpEscape = (s) => {
    return s.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
  };

  $: if (results.length === 1)
    [{value}] = results;
  else
    value = '';

  $: if (value.length)
    dispatch('selectedResult', { value });

</script>

<svelte:window on:click={() => (active = false)} />

<div on:click|stopPropagation class="relative w-56">
  <input
    type="search"
    {placeholder}
    on:focus={() => (active = true)}
    class="form-input block border border-gray-300 rounded w-full
      focus:outline-none focus:shadow-outline-blue focus:border-blue-300 text-sm
      md:text-xs md:leading-5 transition ease-in-out duration-150 py-1 px-3"
    bind:value={search} />
  <ul
    class:hidden={!active}
    class="border absolute w-full bg-white overflow-auto 6rem z-10 shadow-lg">
    {#each results as result}
      <li
        on:click={() => {
          search = result.label;
          ({value} = result);
          active = false;
        }}
        class="text-gray-600 px-2 py-1 hover:bg-gray-200 cursor-pointer">
        {@html result.boldedLabel}
      </li>
    {/each}
  </ul>
</div>

<!-- Adapted from <a href="https://github.com/elcobvg/svelte-autocomplete/blob/master/src/index.html">svelte-autocomplete</a> -->

<!-- Not implemented ideas from original: -->
<!-- Move through list on:keydown  -->

<!-- Adjust height = results.length > maxItems ? maxItems : results.length
this.refs.list.style.height = `${height * 2.25}rem` -->
