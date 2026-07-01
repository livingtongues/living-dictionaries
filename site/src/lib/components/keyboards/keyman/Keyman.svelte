<script lang="ts" module>
  // https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/
  import type { KeymanWeb } from './Keyman.interface'

  declare const keyman: KeymanWeb
</script>

<script lang="ts">
  import IconPhGlobe from '~icons/ph/globe'
  import IconMdiKeyboard from '~icons/mdi/keyboard'
  import IconMdiKeyboardOffOutline from '~icons/mdi/keyboard-off-outline'
  import { run } from 'svelte/legacy'

  import './keyman.css'
  import { onDestroy, onMount, tick } from 'svelte'
  import type { KeymanWritingSystems } from './writing-systems'
  import { keyboard_for_bcp, load_keyman_writing_systems } from './writing-systems'
  import { additionalKeyboards, glossingLanguages } from '../../../glosses/glossing-languages'
  import { Button, loadScriptOnce, Modal, ShowHide } from '$lib/svelte-pieces'
  import { browser } from '$app/environment'

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

  let keyman_writing_systems: KeymanWritingSystems = $state()

  onMount(async () => {
    load_keyman_writing_systems().then((systems) => {
      keyman_writing_systems = systems
    })

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
  const currentBcp = $derived(selectedBcp || bcp)
  const glossLanguage = $derived(glossingLanguages[currentBcp] || additionalKeyboards[currentBcp])
  const resolvedKeyboard = $derived(keyboard_for_bcp(currentBcp, keyman_writing_systems))
  const internalName = $derived(resolvedKeyboard?.internalName)
  const keyboardBcp = $derived(resolvedKeyboard?.keyboardBcp || currentBcp)
  const keyboardId = $derived(`${internalName}@${keyboardBcp}`)
  // Curated gloss languages keep their explicit `showKeyboard` flag; a bcp resolved
  // only via the full Keyman set shows the keyboard toggle whenever a keyboard exists.
  const showKeyboardButton = $derived(glossLanguage ? !!glossLanguage.showKeyboard : !!internalName)

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
    <div bind:this={wrapperEl} class="keyman-wrap" class:sompeng={currentBcp === 'srb-sora'}>
      {@render children_render?.()}

      {#if kmw}
        <div
          class:at-top={position === 'top'}
          class:at-bottom={position === 'bottom'}
          class="keyboard-buttons">
          {#if (show || !bcp) && canChooseKeyboard}
            <button
              class="keyboard-toggle"
              type="button"
              onclick={toggle}
              title="Select Keyboard">
              <IconPhGlobe class="icon-inline" />
            </button>
          {/if}
          {#if showKeyboardButton}
            <button
              class="keyboard-toggle"
              type="button"
              onclick={() => (show = !show)}
              title={show ? 'Keyboard active' : 'Keyboard inactive'}>
              {#if show}
                <IconMdiKeyboard class="icon-inline" />
              {:else}
                <IconMdiKeyboardOffOutline class="icon-inline" />
              {/if}
            </button>
          {/if}
        </div>
      {/if}
    </div>

    {#if showKeyboardOptions}
      <Modal on:close={toggle} noscroll>
        {#snippet heading()}
          <span>Select Keyboard</span>
        {/snippet}
        {#each [...Object.entries(glossingLanguages), ...Object.entries(additionalKeyboards)] as [_bcp, languageDefinition] (_bcp)}
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

<style>
  .keyman-wrap {
    width: 100%;
    position: relative;
  }

  .keyboard-buttons {
    position: absolute;
    right: 0.125rem;
    z-index: 1;
    display: flex;
  }

  .at-top {
    top: 0.1875rem;
  }

  .at-bottom {
    bottom: 0.1875rem;
  }

  .keyboard-toggle {
    padding: 0.5rem;
    display: flex;
    align-items: center;
    background-color: var(--background);
    border-radius: 0.25rem;
  }

  .keyboard-toggle:hover {
    color: #000;
  }
</style>
