<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;
  import Button from 'svelte-pieces/ui/Button.svelte';

  export let attribute:string,
    display: string,
    required = false,
    minLength = 0,
    maxlength = 30;
  import { createEventDispatcher } from 'svelte';
  //TODO create a function that cleans and validates the data. Maybe not necessary
  const dispatch = createEventDispatcher<{
    save: {attribute: string}
  }>()
</script>

<form class="mt-4" on:submit|preventDefault={() => dispatch('save', {attribute})}>
  <label for={attribute} class="block text-xs leading-5 text-gray-700 mb-1">
    {display}
  </label>
  <div class="flex flex-grow rounded-md shadow-sm">
    <div class="flex-grow focus-within:z-10">
      <input
        id={attribute}
        type="text"
        autocomplete="off"
        autocorrect="off"
        spellcheck={false}
        {minLength}
        {maxlength}
        {required}
        bind:value={attribute}
        class="appearance-none rounded-none block w-full px-3 py-2 border
          border-gray-300 ltr:rounded-l-md rtl:rounded-r-md text-gray-900 placeholder-gray-400
          focus:outline-none focus:shadow-outline-blue focus:border-blue-300
          sm:text-sm sm:leading-5 transition ease-in-out duration-150"
        placeholder={`Dictionary ${attribute}`} />
    </div>
    <Button type="submit" form="filled">
      {t ? $t('misc.save') : 'Save'}
    </Button>
  </div>
</form>
