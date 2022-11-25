<script lang="ts">
  // https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/
  import { getContext } from 'svelte';
  import { additionalKeyboards, glossingLanguages } from '../../../glosses/glossing-languages';
  import { keymanKey, type keymanKeyContext } from './context';

  export let bcp: string;
  export let value: string;
  export let placeholder = '';
  export let showKeyboard = false;
  export let rows = 4;

  const { getKeyman } = getContext<keymanKeyContext>(keymanKey);
  const kmw = getKeyman();
  let el: HTMLTextAreaElement;

  $: glossLanguage = glossingLanguages[bcp] || additionalKeyboards[bcp];
  $: internalName = glossLanguage?.internalName;
  $: keyboardBcp = glossLanguage?.useKeyboard ? glossLanguage.useKeyboard : bcp;
  $: keyboardId = `${internalName}@${keyboardBcp}`;

  $: if (showKeyboard && internalName) {
    (async () => {
      await kmw.addKeyboards(keyboardId);
      kmw.attachToControl(el);
      kmw.setKeyboardForControl(el, internalName, keyboardBcp);
      el.focus();
    })();
  }
</script>

<div class="flex w-full relative">
  <textarea
    type="text"
    {rows}
    {placeholder}
    bind:this={el}
    class="border shadow px-3 py-1 w-full"
    bind:value
    class:kmw-disabled={!showKeyboard} />

  {#if glossLanguage?.showKeyboard}
    <button
      class="absolute right-2px bottom-2px bg-white hover:text-black p-2 flex"
      type="button"
      on:click={() => (showKeyboard = !showKeyboard)}
      title={showKeyboard ? 'Keyboard active' : 'Keyboard inactive'}>
      {#if showKeyboard}
        <span class="i-mdi-keyboard" />
      {:else}
        <span class="i-mdi-keyboard-outline" />
      {/if}
    </button>
  {/if}
</div>
