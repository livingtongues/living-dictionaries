<script lang="ts">
  import { Button } from 'svelte-pieces'
  import sanitize from 'xss'
  import type { EntryFieldValue } from '@living-dictionaries/types'
  import Keyman from '$lib/components/keyboards/keyman/Keyman.svelte'
  import { page } from '$app/stores'

  export let value = ''
  export let field: EntryFieldValue
  export let isSompeng = false
  export let addingLexeme = false
  export let bcp: string = undefined
  export let on_update: (new_value: string) => void
  export let on_close: () => void

  let inputEl: HTMLInputElement

  function save() {
    value = inputEl?.value || value // IpaKeyboard modifies input's value from outside this component so the bound value here doesn't update. This is hacky and the alternative is to emit events from the IpaKeyboard rather than bind to any neighboring element. This makes the adding and backspacing functions potentially needing to be applied in every context where the IPA keyboard is used. Until we know more how the IPA keyboard will be used, this line here is sufficient.
    on_update(value.trim())
    on_close()
  }

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 5)
  }

  const editorConfig = {
    toolbar: [
      // 'heading',
      // '|',
      'bold',
      'italic',
      'underline',
      'smallCaps',
      'link',
      'bulletedList',
      'numberedList',
      'blockQuote',
      'undo',
      'redo',
    ],
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

<form on:submit|preventDefault={save}>
  <div class="rounded-md shadow-sm">
    {#if field === 'notes'}
      {#await import('$lib/components/editor/ClassicCustomized.svelte') then { default: ClassicCustomized }}
        <Keyman fixed target=".ck-editor__editable_inline" canChooseKeyboard position="bottom">
          <ClassicCustomized {editorConfig} html={value} on:update={({ detail }) => (value = detail)} />
        </Keyman>
      {/await}
    {:else if field === 'gloss' || field === 'example_sentence'}
      <Keyman fixed {bcp}>
        <input
          bind:this={inputEl}
          dir="ltr"
          type="text"
          use:autofocus
          bind:value
          class:sompeng={isSompeng}
          class="form-input block w-full pr-9" />
      </Keyman>
    {:else if field === 'local_orthography' || field === 'lexeme'}
      <Keyman fixed canChooseKeyboard>
        <input
          bind:this={inputEl}
          dir="ltr"
          type="text"
          required={field === 'lexeme'}
          use:autofocus
          bind:value
          class:sompeng={isSompeng}
          class="form-input block w-full pr-9" />
      </Keyman>
    {:else}
      <input
        bind:this={inputEl}
        dir="ltr"
        type="text"
        use:autofocus
        bind:value
        class="form-input block w-full" />
    {/if}

    {#if field === 'phonetic'}
      {#await import('$lib/components/keyboards/ipa/IpaKeyboard.svelte') then { default: IpaKeyboard }}
        <div class="mt-2">
          <IpaKeyboard target={inputEl} />
        </div>
      {/await}
    {/if}

    {#if field === 'interlinearization'}
      <div class="mt-3 text-sm hidden md:block" />
      <Button
        class="mt-1"
        size="sm"
        form="simple"
        onclick={() => (value = smallCapsSelection(inputEl))}>Toggle sᴍᴀʟʟCᴀᴘs for selection</Button>
    {/if}

    {#if field === 'scientific_names'}
      <Button
        class="mt-1"
        size="sm"
        form="simple"
        onclick={() => (value = italicizeSelection(inputEl))}><i>Italicize</i> selection</Button>
      {#if value.includes('<i>')}
        <div class="tw-prose mt-2 p-1 shadow bg-gray-200">
          {@html sanitize(value)}
        </div>
      {/if}
    {/if}
  </div>

  <div class="modal-footer">
    <Button onclick={on_close} form="simple" color="black">
      {$page.data.t('misc.cancel')}
    </Button>
    <div class="w-1" />
    {#if addingLexeme}
      <Button type="submit" form="filled">
        {$page.data.t('misc.next')}
        <span class="i-fa6-solid-chevron-right rtl-x-flip -mt-.5" />
      </Button>
    {:else}
      <Button type="submit" form="filled">
        {$page.data.t('misc.save')}
      </Button>
    {/if}
  </div>
</form>

<style>
  :global(.ck-editor__editable_inline) {
    --at-apply: md:min-h-50vh;
  }
</style>
