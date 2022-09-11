<script lang="ts">
  // https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/
  import { getContext, onMount } from 'svelte';
  import { glossingLanguages } from '../../../glosses/glossing-languages';
  import { keymanKey, type keymanKeyContext } from './context';

  export let bcp: string;
  export let value: string;
  export let showKeyboard = true;
  export let rows = 4;

  const { getKeyman } = getContext<keymanKeyContext>(keymanKey);
  const kmw = getKeyman();
  let el: HTMLTextAreaElement;

  $: internalName = glossingLanguages[bcp] && glossingLanguages[bcp].internalName;
  $: keyboardId = (internalName && `${internalName}@${bcp}`) || `@${bcp}`;

  onMount(async () => {
    await kmw.addKeyboards(keyboardId);
    if (internalName) {
      kmw.attachToControl(el);
      kmw.setKeyboardForControl(el, internalName, bcp);
    }
  });
</script>

<div class="flex w-full relative">
  <textarea
    {rows}
    type="text"
    bind:this={el}
    class="border shadow px-3 py-1 w-full"
    bind:value
    class:kmw-disabled={!showKeyboard} />

  <button
    class="absolute right-0 bottom-0 hover:text-black py-2 px-3 flex"
    type="button"
    on:click={() => (showKeyboard = !showKeyboard)}
    title={showKeyboard ? 'Keyboard active' : 'Keyboard inactive'}>
    {#if showKeyboard}
      <span class="i-mdi-keyboard" />
    {:else}
      <span class="i-mdi-keyboard-outline" />
    {/if}
  </button>
</div>
