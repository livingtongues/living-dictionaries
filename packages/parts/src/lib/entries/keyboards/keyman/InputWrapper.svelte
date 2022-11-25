<script lang="ts">
  // https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/
  import { getContext, onMount } from 'svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import { additionalKeyboards, glossingLanguages } from '../../../glosses/glossing-languages';
  import { keymanKey, type keymanKeyContext } from './context';

  /**
   * When using keyboard inside a fixed context like a modal, set fixed to true to use fixed positioning instead of absolute positioning to keep keyboard with fixed input, otherwise it will match page scroll height
   */
  export let fixed = false;
  export let bcp: string;
  export let canChooseKeyboard = false;
  export let target: string | Element = undefined;
  export let show = false;

  const { getKeyman } = getContext<keymanKeyContext>(keymanKey);
  const kmw = getKeyman();
  let wrapperEl: HTMLDivElement;
  let inputEl: HTMLInputElement | HTMLTextAreaElement;

  onMount(async () => {
    if (target) {
      // @ts-ignore
      inputEl = wrapperEl.querySelector(target);
      if (!inputEl) {
        // wait for CKEditor to init so target element can be found
        await new Promise((r) => setTimeout(r, 3000));
        // @ts-ignore
        inputEl = wrapperEl.querySelector(target);
      }
    }

    if (!inputEl) {
      inputEl = wrapperEl.firstElementChild as HTMLInputElement | HTMLTextAreaElement;
    }

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
      <slot />
    </div>

    <div class="absolute z-1 right-0.5 top-0.75 flex">
      {#if show && canChooseKeyboard}
        <button
          class="hover:text-black p-2 flex items-center bg-white rounded"
          type="button"
          on:click={toggle}
          title="Select Keyboard">
          <span class="i-ph-globe" />
        </button>
      {/if}
      {#if glossLanguage?.showKeyboard}
        <button
          class="hover:text-black p-2 flex items-center bg-white rounded"
          type="button"
          on:click={() => (show = !show)}
          title={show ? 'Keyboard active' : 'Keyboard inactive'}>
          {#if show}
            <span class="i-mdi-keyboard" />
          {:else}
            <span class="i-mdi-keyboard-off-outline" />
          {/if}
        </button>
      {/if}
    </div>
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
