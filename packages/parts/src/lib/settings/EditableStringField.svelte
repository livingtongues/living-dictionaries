<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;
  import FormWrapper from '../helpers/FormWrapper.svelte';

  export let attribute:string,
    display: string = undefined,
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
      class="form-input w-full"
      placeholder={`Dictionary ${attribute}`} />
  </div>
</FormWrapper>
