<script lang="ts">
  // https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/
  import { getContext, onMount } from 'svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import { additionalKeyboards, glossingLanguages } from '../../../glosses/glossing-languages';
  import { keymanKey, type keymanKeyContext } from './context';

  export let bcp: string;
  export let canChooseKeyboard = false;
  export let value: string = undefined;
  export let placeholder = '';
  export let show = false;
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

  let selectedBcp: string;
  $: currentBcp = selectedBcp || bcp;
  $: glossLanguage = glossingLanguages[currentBcp] || additionalKeyboards[currentBcp];
  $: internalName = glossLanguage?.internalName;
  $: keyboardBcp = glossLanguage?.useKeyboard ? glossLanguage.useKeyboard : currentBcp;
  $: keyboardId = `${internalName}@${keyboardBcp}`;

  $: if (show && internalName) {
    (async () => {
      await kmw.addKeyboards(keyboardId);
      if (inputEl) {
        kmw.attachToControl(inputEl);
        kmw.setKeyboardForControl(inputEl, internalName, keyboardBcp);
        inputEl.focus();
      }
    })();
  }

  $: if (show) {
    inputEl?.classList.remove('kmw-disabled');
  } else {
    inputEl?.classList.add('kmw-disabled');
  }
</script>

<ShowHide let:show={showKeyboardOptions} let:toggle>
  <div class="flex w-full relative" class:sompeng={currentBcp === 'srb-sora'}>
    <div bind:this={wrapperEl} class="w-full">
      <slot>
        <input {placeholder} class="border shadow px-3 pl-1 pr-9 w-full" bind:value />
      </slot>
    </div>

    {#if glossLanguage?.showKeyboard}
      <button
        class="absolute z-1 right-0.5 top-0.5 bottom-0.5 hover:text-black px-2 flex items-center bg-white rounded"
        type="button"
        on:click={() => (show = !show)}
        title={show ? 'Keyboard active' : 'Keyboard inactive'}>
        {#if show}
          <span class="i-mdi-keyboard" />
        {:else}
          <span class="i-mdi-keyboard-off" />
        {/if}
      </button>
    {/if}
    {#if show && canChooseKeyboard}
      <button
        class="absolute z-1 right-8 top-0.5 bottom-0.5 hover:text-black px-2 flex items-center bg-white rounded"
        type="button"
        on:click={toggle}
        title="Select Keyboard">
        <span class="i-ph-globe" />
      </button>
    {/if}
  </div>

  {#if showKeyboardOptions}
    <Modal on:close={toggle} noscroll>
      <span slot="heading"> Select Keyboard </span>
      {#each [...Object.entries(glossingLanguages), ...Object.entries(additionalKeyboards)] as [_bcp, languageDefinition]}
        {#if languageDefinition.showKeyboard}
          <Button
            form="menu"
            size="sm"
            onclick={() => {
              toggle();
              selectedBcp = _bcp;
            }}
            active={_bcp === bcp}>{languageDefinition.vernacularName} ({_bcp})</Button>
        {/if}
      {/each}
    </Modal>
  {/if}
</ShowHide>
