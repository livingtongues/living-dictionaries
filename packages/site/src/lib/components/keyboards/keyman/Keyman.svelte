<script lang="ts" context="module">
  // https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/
  import type { KeymanWeb } from './Keyman.interface';
  declare const keyman: KeymanWeb;
</script>

<script lang="ts">
  import './keyman.css';
  import { onDestroy, onMount, tick } from 'svelte';
  import { Button, ShowHide, Modal } from 'svelte-pieces';
  import { additionalKeyboards, glossingLanguages } from '../../../glosses/glossing-languages';
  import { loadScriptOnce } from 'sveltefirets';

  /**
   * When using keyboard inside a fixed context like a modal, set fixed to true to use fixed positioning instead of absolute positioning to keep keyboard with fixed input, otherwise it will match page scroll height
   */
  export let fixed = false;
  export let bcp: string = undefined;
  export let canChooseKeyboard = false;
  export let target: string = undefined;
  export let show = false;
  export let position: 'top' | 'bottom' = 'top';
  export let version = '16.0.141'; // https://keyman.com/developer/keymanweb/, https://keyman.com/downloads/pre-release/, https://help.keyman.com/developer/engine/web/history

  let kmw: KeymanWeb;
  let wrapperEl: HTMLDivElement;
  let inputEl: HTMLInputElement | HTMLTextAreaElement;

  onMount(async () => {
    await loadScriptOnce(`https://s.keyman.com/kmw/engine/${version}/keymanweb.js`);

    await keyman.init({
      attachType: 'manual',
    });
    kmw = keyman;

    await targetInput();

    const root = document.documentElement;
    if (fixed) root.style.setProperty('--kmw-osk-pos', 'fixed');
  });

  onDestroy(() => {
    const root = document.documentElement;
    root.style.setProperty('--kmw-osk-pos', 'absolute');
    kmw.detachFromControl(inputEl);
  })

  async function targetInput() {
    if (target) {
      inputEl = wrapperEl.querySelector(target);
      if (!inputEl) await waitForCKEditorToInitAndBeTargeted();
    }

    if (!inputEl)
      inputEl = wrapperEl.firstElementChild as HTMLInputElement | HTMLTextAreaElement;

  }

  function waitForCKEditorToInitAndBeTargeted() {
    return new Promise((resolve) => {
      let attempts = 0;
      const MAX_ATTEMPTS = 10
      const interval = setInterval(() => {
        attempts++;
        inputEl = wrapperEl.querySelector(target);
        if (inputEl || attempts > MAX_ATTEMPTS) {
          clearInterval(interval);
          resolve;
        }
      }, 500) as unknown as number;
    });
  }

  let selectedBcp: string;
  $: currentBcp = selectedBcp || bcp;
  $: glossLanguage = glossingLanguages[currentBcp] || additionalKeyboards[currentBcp];
  $: internalName = glossLanguage?.internalName;
  $: keyboardBcp = glossLanguage?.useKeyboard ? glossLanguage.useKeyboard : currentBcp;
  $: keyboardId = `${internalName}@${keyboardBcp}`;

  $: if (kmw && show && internalName) {
    (async () => {
      await kmw.addKeyboards(keyboardId);
      if (inputEl) {
        kmw.attachToControl(inputEl);
        kmw.setKeyboardForControl(inputEl, internalName, keyboardBcp);
        inputEl.focus();

        if (currentBcp === 'srb-sora') {
          await tick();
          document.querySelector('.kmw-osk-frame')?.classList.add('sompeng');
        } else {
          document.querySelector('.kmw-osk-frame')?.classList.remove('sompeng');
        }
      }
    })();
  }

  $: if (show)
    inputEl?.classList.remove('kmw-disabled');
  else
    inputEl?.classList.add('kmw-disabled');

</script>

<ShowHide let:show={showKeyboardOptions} let:toggle>
  <div bind:this={wrapperEl} class="w-full relative" class:sompeng={currentBcp === 'srb-sora'}>
    <slot />

    {#if kmw}
      <div
        class:top-0.75={position === 'top'}
        class:bottom-0.75={position === 'bottom'}
        class="absolute right-0.5 z-1 flex">
        {#if (show || !bcp) && canChooseKeyboard}
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
    {/if}
  </div>

  {#if showKeyboardOptions}
    <Modal on:close={toggle} noscroll>
      <span slot="heading">Select Keyboard</span>
      {#each [...Object.entries(glossingLanguages), ...Object.entries(additionalKeyboards)] as [_bcp, languageDefinition]}
        {#if languageDefinition.showKeyboard}
          <Button
            form="menu"
            size="sm"
            onclick={() => {
              toggle();
              selectedBcp = _bcp;
              show = true;
            }}
            active={_bcp === bcp}>{languageDefinition.vernacularName}</Button>
        {/if}
      {/each}
    </Modal>
  {/if}
</ShowHide>
