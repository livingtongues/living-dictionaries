<script lang="ts">
  // https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/
  import { getContext, onMount } from 'svelte';
  import { additionalKeyboards, glossingLanguages } from '../../../glosses/glossing-languages';
  import { keymanKey, type keymanKeyContext } from './context';

  export let bcp: string;
  export let value: string = undefined;
  export let placeholder = '';
  export let showKeyboard = false;
  export let fixed = false;

  const { getKeyman } = getContext<keymanKeyContext>(keymanKey);
  const kmw = getKeyman();
  let wrapperEl: HTMLDivElement;
  let inputEl: HTMLInputElement;

  onMount(() => {
    inputEl = wrapperEl.firstElementChild as HTMLInputElement;
    const root = document.documentElement;
    if (fixed) {
      root.style.setProperty('--kmw-osk-pos', 'fixed');
    }

    return () => {
      root.style.setProperty('--kmw-osk-pos', 'absolute');
      kmw.detachFromControl(inputEl);
    };
  });

  $: glossLanguage = glossingLanguages[bcp] || additionalKeyboards[bcp];
  $: internalName = glossLanguage?.internalName;
  $: keyboardBcp = glossLanguage?.useKeyboard ? glossLanguage.useKeyboard : bcp;
  $: keyboardId = `${internalName}@${keyboardBcp}`;

  $: if (showKeyboard && internalName) {
    (async () => {
      await kmw.addKeyboards(keyboardId);
      if (inputEl) {
        kmw.attachToControl(inputEl);
        kmw.setKeyboardForControl(inputEl, internalName, keyboardBcp);
        inputEl.focus();
      }
    })();
  }

  $: if (showKeyboard) {
    inputEl?.classList.remove('kmw-disabled');
  } else {
    inputEl?.classList.add('kmw-disabled');
  }
</script>

<div class="flex w-full relative">
  <div bind:this={wrapperEl} class="w-full">
    <slot>
      <input {placeholder} class="border shadow px-3 pl-1 pr-9 w-full" bind:value />
    </slot>
  </div>

  {#if glossLanguage?.showKeyboard}
    <button
      class="absolute z-1 right-2px top-2px bottom-2px hover:text-black px-2 flex items-center bg-white rounded"
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
