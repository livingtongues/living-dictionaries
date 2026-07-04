<script lang="ts">
  import sanitize from 'xss'
  import type { EntryFieldValue } from '$lib/types'
  import Button from '$lib/components/ui/Button.svelte'
  import Form from '$lib/components/ui/Form.svelte'
  import Keyman from '$lib/components/keyboards/keyman/Keyman.svelte'
  import MarkdownEditor from '$lib/markdown/MarkdownEditor.svelte'
  import { page } from '$app/state'
  import IconFa6SolidChevronRight from '~icons/fa6-solid/chevron-right'

  interface Props {
    value?: string
    field: EntryFieldValue
    isSompeng?: boolean
    addingLexeme?: boolean
    bcp?: string
    on_update: (new_value: string) => void | Promise<void>
    on_close: () => void
  }

  let {
    value = $bindable(''),
    field,
    isSompeng = false,
    addingLexeme = false,
    bcp = undefined,
    on_update,
    on_close,
  }: Props = $props()

  let inputEl: HTMLInputElement = $state()

  async function save() {
    value = inputEl?.value || value // IpaKeyboard modifies input's value from outside this component so the bound value here doesn't update. This is hacky and the alternative is to emit events from the IpaKeyboard rather than bind to any neighboring element. This makes the adding and backspacing functions potentially needing to be applied in every context where the IPA keyboard is used. Until we know more how the IPA keyboard will be used, this line here is sufficient.
    await on_update(value.trim())
    on_close()
  }

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 5)
  }

  const pairs = {
    'a': 'ᴀ',
    'b': 'ʙ',
    'c': 'ᴄ',
    'd': 'ᴅ',
    'e': 'ᴇ',
    'f': 'ꜰ',
    'g': 'ɢ',
    'h': 'ʜ',
    'i': 'ɪ',
    'j': 'ᴊ',
    'k': 'ᴋ',
    'l': 'ʟ',
    'm': 'ᴍ',
    'n': 'ɴ',
    'o': 'ᴏ',
    'p': 'ᴘ',
    'q': '🇶',
    'r': 'ʀ',
    't': 'ᴛ',
    'u': 'ᴜ',
    'v': 'ᴠ',
    'w': 'ᴡ',
    'x': 'x',
    'y': 'ʏ',
    'z': 'ᴢ',
    'ᴀ': 'a',
    'ʙ': 'b',
    'ᴄ': 'c',
    'ᴅ': 'd',
    'ᴇ': 'e',
    'ꜰ': 'f',
    'ɢ': 'g',
    'ʜ': 'h',
    'ɪ': 'i',
    'ᴊ': 'j',
    'ᴋ': 'k',
    'ʟ': 'l',
    'ᴍ': 'm',
    'ɴ': 'n',
    'ᴏ': 'o',
    'ᴘ': 'p',
    '🇶': 'q',
    'ʀ': 'r',
    'ᴛ': 't',
    'ᴜ': 'u',
    'ᴠ': 'v',
    'ᴡ': 'w',
    'ʏ': 'y',
    'ᴢ': 'z',
  }

  function smallCapsSelection(el: HTMLInputElement) {
    const { selectionStart, selectionEnd } = el
    const selection = el.value.slice(selectionStart, selectionEnd)
    const replacement = Array.from(selection)
      .map((character: string) => pairs[character] || character)
      .join('')
    return el.value.slice(0, selectionStart) + replacement + el.value.slice(selectionEnd)
  }

  function italicizeSelection(el: HTMLInputElement) {
    const { selectionStart, selectionEnd } = el
    const selection = el.value.slice(selectionStart, selectionEnd)
    const replacement = selection.length ? `<i>${selection}</i>` : selection
    return el.value.slice(0, selectionStart) + replacement + el.value.slice(selectionEnd)
  }
</script>

<Form onsubmit={save}>
  {#snippet children({ loading })}
    <div class="field-editor">
      {#if field === 'notes'}
        <Keyman fixed target=".ProseMirror" canChooseKeyboard position="bottom">
          <MarkdownEditor preset="minimal" bind:value />
        </Keyman>
      {:else if field === 'gloss' || field === 'example_sentence'}
        <Keyman fixed {bcp}>
          <input
            bind:this={inputEl}
            dir="ltr"
            type="text"
            use:autofocus
            bind:value
            class:sompeng={isSompeng}
            class="keyboard-input" />
        </Keyman>
      {:else if field === 'local_orthography' || field === 'lexeme' || field === 'linguistic_history'}
        <Keyman fixed {bcp} canChooseKeyboard>
          <input
            bind:this={inputEl}
            dir="ltr"
            type="text"
            required={field === 'lexeme'}
            use:autofocus
            bind:value
            class:sompeng={isSompeng}
            class="keyboard-input" />
        </Keyman>
      {:else if field === 'phonetic'}
        {#await import('$lib/components/keyboards/ipa/IpaKeyboard.svelte') then { default: IpaKeyboard }}
          <div style="margin-top: 0.5rem">
            <IpaKeyboard on_ipa_change={new_value => value = new_value}>
              <input
                dir="ltr"
                type="text"
                use:autofocus
                bind:value
                class="plain-input" />
            </IpaKeyboard>
          </div>
        {/await}
      {:else}
        <input
          bind:this={inputEl}
          dir="ltr"
          type="text"
          use:autofocus
          bind:value
          class="plain-input" />
      {/if}

      {#if field === 'interlinearization'}
        <div class="interlinear-gap"></div>
        <Button
          class="edit-helper-button"
          size="sm"
          form="simple"
          onclick={() => (value = smallCapsSelection(inputEl))}>Toggle sᴍᴀʟʟCᴀᴘs for selection</Button>
      {/if}

      {#if field === 'scientific_names'}
        <Button
          class="edit-helper-button"
          size="sm"
          form="simple"
          onclick={() => (value = italicizeSelection(inputEl))}><i>Italicize</i> selection</Button>
        {#if value.includes('<i>')}
          <div class="tw-prose italic-preview">
            {@html sanitize(value)}
          </div>
        {/if}
      {/if}
    </div>

    <div class="modal-footer">
      <Button disabled={loading} onclick={on_close} form="simple" color="black">
        {page.data.t('misc.cancel')}
      </Button>
      <div style="width: 0.25rem"></div>
      {#if addingLexeme}
        <Button {loading} type="submit" form="filled">
          {page.data.t('misc.next')}
          <IconFa6SolidChevronRight class="icon-inline rtl-x-flip" style="margin-top: -0.125rem" />
        </Button>
      {:else}
        <Button {loading} type="submit" form="filled">
          {page.data.t('misc.save')}
        </Button>
      {/if}
    </div>
  {/snippet}
</Form>

<style>
  @media (min-width: 768px) {
    .field-editor :global(.ProseMirror) {
      min-height: 50vh;
    }
  }

  .field-editor {
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
  }

  .field-editor :global(.keyboard-input) {
    display: block;
    width: 100%;
    padding-right: 4rem;
  }

  .field-editor :global(.plain-input) {
    display: block;
    width: 100%;
  }

  .interlinear-gap {
    margin-top: 0.75rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    display: none;
  }

  @media (min-width: 768px) {
    .interlinear-gap {
      display: block;
    }
  }

  .field-editor :global(.edit-helper-button) {
    margin-top: 0.25rem;
  }

  .italic-preview {
    margin-top: 0.5rem;
    padding: 0.25rem;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); /* shadow */
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
  }
</style>
