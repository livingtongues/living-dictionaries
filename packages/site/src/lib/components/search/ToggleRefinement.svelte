<script lang="ts">
  import type { InstantSearch } from 'instantsearch.js';
  import type { ToggleRefinementRenderState } from 'instantsearch.js/es/connectors/toggle-refinement/connectToggleRefinement';
  import { connectToggleRefinement } from 'instantsearch.js/es/connectors';
  import { onMount } from 'svelte';

  // Can't have the same attribute mounted twice with InstantSearch (ie - cannot do hasImage true and hasImage false) but you can remove one and mount the other. The attribute being toggled is saved in the url but not the "on" value, so when they are both mounted they trigger and cancel out the other.
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

{#if value?.onFacetValue.count}
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
