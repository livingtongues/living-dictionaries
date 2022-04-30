<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;
  import FormWrapper from '../helpers/FormWrapper.svelte';

  export let attribute:string,
    display: string,
    required = false,
    wrap = true,
    minLength = 0,
    maxlength = 30;
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    save: {attribute: string}
  }>()
</script>

<FormWrapper action={() => dispatch('save', {attribute})} {wrap} {t} {attribute} {display}>
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
</FormWrapper>
