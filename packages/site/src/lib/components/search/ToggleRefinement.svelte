<script lang="ts">
  import type { InstantSearch } from 'instantsearch.js';
  import type { ToggleRefinementRenderState } from 'instantsearch.js/es/connectors/toggle-refinement/connectToggleRefinement';
  // import { connectToggleRefinement } from 'instantsearch.js/es/connectors';
  import { connectToggleRefinement } from 'instantsearch.js/cjs/connectors/index.js';
  import { onMount } from 'svelte';

  export let search: InstantSearch,
    attribute = '',
    on = true,
    label = '';

  let value: ToggleRefinementRenderState['value'];
  let refine: (arg0: any) => any;

  onMount(() => {
    const customToggleRefinement = connectToggleRefinement((params) => {
      ({ value, refine } = params);
    });

    search.addWidgets([
      customToggleRefinement({
        attribute,
        on,
      }),
    ]);
  });
</script>

{#if value && value.onFacetValue.count}
  <div class="flex items-center my-2">
    <input
      id={label.replace(' ', '')}
      type="checkbox"
      checked={value.isRefined}
      on:change={() => {
        refine({ isRefined: value.isRefined });
      }} />
    <div class="w-2" />
    <label for={label.replace(' ', '')} class="block text-sm leading-5 text-gray-900">
      {label}
      <span class="text-xs text-gray-600"> ({value.onFacetValue.count}) </span>
      <!-- value.offFacetValue.count -->
    </label>
  </div>
{/if}
