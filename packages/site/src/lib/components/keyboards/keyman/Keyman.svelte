<script lang="ts" module>
  // https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/
  import type { KeymanWeb } from './Keyman.interface'

  declare const keyman: KeymanWeb
</script>

<script lang="ts">
  import { browser } from '$app/environment'

  import { Button, loadScriptOnce, Modal, ShowHide } from '$lib/svelte-pieces'
  import { onDestroy, onMount, tick } from 'svelte'
  import { run } from 'svelte/legacy'
  import { additionalKeyboards, glossingLanguages } from '../../../glosses/glossing-languages'
  import './keyman.css'

  interface Props {
    /**
     * When using keyboard inside a fixed context like a modal, set fixed to true to use fixed positioning instead of absolute positioning to keep keyboard with fixed input, otherwise it will match page scroll height
     */
    fixed?: boolean
    bcp?: string
    canChooseKeyboard?: boolean
    target?: string
    show?: boolean
    position?: 'top' | 'bottom'
    version?: string // https://keyman.com/developer/keymanweb/, https://keyman.com/downloads/pre-release/, https://help.keyman.com/developer/engine/web/history
    children?: import('svelte').Snippet
  }

  let {
    fixed = false,
    bcp = undefined,
    canChooseKeyboard = false,
    target = undefined,
    show = $bindable(false),
    position = 'top',
    version = '16.0.141',
    children,
  }: Props = $props()

  let kmw: KeymanWeb = $state()
  let wrapperEl: HTMLDivElement = $state()
  let inputEl: HTMLInputElement | HTMLTextAreaElement = $state()

  onMount(async () => {
    await loadScriptOnce(`https://s.keyman.com/kmw/engine/${version}/keymanweb.js`)

    await keyman.init({
      attachType: 'manual',
    })
    kmw = keyman

    await targetInput()

    const root = document.documentElement
    if (fixed) root.style.setProperty('--kmw-osk-pos', 'fixed')
  })

  onDestroy(() => {
    if (browser) {
      const root = document.documentElement
      root.style.setProperty('--kmw-osk-pos', 'absolute')
      kmw?.detachFromControl(inputEl)
    }
  })

  async function targetInput() {
    if (target) {
      inputEl = wrapperEl.querySelector(target)
      if (!inputEl) await waitForCKEditorToInitAndBeTargeted()
    }

    if (!inputEl)
      inputEl = wrapperEl.firstElementChild as HTMLInputElement | HTMLTextAreaElement
  }

  function waitForCKEditorToInitAndBeTargeted() {
    return new Promise((resolve) => {
      let attempts = 0
      const MAX_ATTEMPTS = 10
      const interval = setInterval(() => {
        attempts++
        inputEl = wrapperEl.querySelector(target)
        if (inputEl || attempts > MAX_ATTEMPTS) {
          clearInterval(interval)
          resolve
        }
      }, 500) as unknown as number
    })
  }

  let selectedBcp: string = $state()
  let currentBcp = $derived(selectedBcp || bcp)
  let glossLanguage = $derived(glossingLanguages[currentBcp] || additionalKeyboards[currentBcp])
  let internalName = $derived(glossLanguage?.internalName)
  let keyboardBcp = $derived(glossLanguage?.useKeyboard ? glossLanguage.useKeyboard : currentBcp)
  let keyboardId = $derived(`${internalName}@${keyboardBcp}`)

  run(() => {
    if (kmw && show && internalName) {
      (async () => {
        await kmw.addKeyboards(keyboardId)
        if (inputEl) {
          kmw.attachToControl(inputEl)
          kmw.setKeyboardForControl(inputEl, internalName, keyboardBcp)
          inputEl.focus()

          if (currentBcp === 'srb-sora') {
            await tick()
            document.querySelector('.kmw-osk-frame')?.classList.add('sompeng')
          } else {
            document.querySelector('.kmw-osk-frame')?.classList.remove('sompeng')
          }
        }
      })()
    }
  })

  run(() => {
    if (show)
      inputEl?.classList.remove('kmw-disabled')
    else
      inputEl?.classList.add('kmw-disabled')
  })

  const children_render = $derived(children)
</script>

<ShowHide>
  {#snippet children({ show: showKeyboardOptions, toggle })}
    <div bind:this={wrapperEl} class="w-full relative" class:sompeng={currentBcp === 'srb-sora'}>
      {@render children_render?.()}

      {#if kmw}
        <div
          class:top-0.75={position === 'top'}
          class:bottom-0.75={position === 'bottom'}
          class="absolute right-0.5 z-1 flex">
          {#if (show || !bcp) && canChooseKeyboard}
            <button
              class="hover:text-black p-2 flex items-center bg-white rounded"
              type="button"
              onclick={toggle}
              title="Select Keyboard">
              <span class="i-ph-globe"></span>
            </button>
          {/if}
          {#if glossLanguage?.showKeyboard}
            <button
              class="hover:text-black p-2 flex items-center bg-white rounded"
              type="button"
              onclick={() => (show = !show)}
              title={show ? 'Keyboard active' : 'Keyboard inactive'}>
              {#if show}
                <span class="i-mdi-keyboard"></span>
              {:else}
                <span class="i-mdi-keyboard-off-outline"></span>
              {/if}
            </button>
          {/if}
        </div>
      {/if}
    </div>

    {#if showKeyboardOptions}
      <Modal on_close={toggle} noscroll>
        {#snippet heading()}
          <span>Select Keyboard</span>
        {/snippet}
        {#each [...Object.entries(glossingLanguages), ...Object.entries(additionalKeyboards)] as [_bcp, languageDefinition]}
          {#if languageDefinition.showKeyboard}
            <Button
              form="menu"
              size="sm"
              onclick={() => {
                toggle()
                selectedBcp = _bcp
                show = true
              }}
              active={_bcp === bcp}>{languageDefinition.vernacularName}</Button>
          {/if}
        {/each}
      </Modal>
    {/if}
  {/snippet}
</ShowHide>
