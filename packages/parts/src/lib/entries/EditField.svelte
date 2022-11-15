<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  import { createEventDispatcher, getContext } from 'svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import Keyman from './keyboards/keyman/Keyman.svelte';
  import InputWrapper from './keyboards/keyman/InputWrapper.svelte';
  const dispatch = createEventDispatcher<{
    close: boolean;
    valueupdate: { field: string; newValue: string };
  }>();

  export let value = '';
  export let field: string;
  export let display: string = undefined; // used only for Sompeng-Mardir now that Modal is separate
  export let adding = false;

  const glosses:string[] = getContext('glosses');

  function close() {
    dispatch('close');
  }

  function save() {
    dispatch('valueupdate', {
      field,
      newValue: value.trim(),
    });
    close();
  }

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 5);
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
  };

  const pairs = {
    a: 'ᴀ',
    b: 'ʙ',
    c: 'ᴄ',
    d: 'ᴅ',
    e: 'ᴇ',
    f: 'ꜰ',
    g: 'ɢ',
    h: 'ʜ',
    i: 'ɪ',
    j: 'ᴊ',
    k: 'ᴋ',
    l: 'ʟ',
    m: 'ᴍ',
    n: 'ɴ',
    o: 'ᴏ',
    p: 'ᴘ',
    q: '🇶',
    r: 'ʀ',
    t: 'ᴛ',
    u: 'ᴜ',
    v: 'ᴠ',
    w: 'ᴡ',
    x: 'x',
    y: 'ʏ',
    z: 'ᴢ',
    ᴀ: 'a',
    ʙ: 'b',
    ᴄ: 'c',
    ᴅ: 'd',
    ᴇ: 'e',
    ꜰ: 'f',
    ɢ: 'g',
    ʜ: 'h',
    ɪ: 'i',
    ᴊ: 'j',
    ᴋ: 'k',
    ʟ: 'l',
    ᴍ: 'm',
    ɴ: 'n',
    ᴏ: 'o',
    ᴘ: 'p',
    '🇶': 'q',
    ʀ: 'r',
    ᴛ: 't',
    ᴜ: 'u',
    ᴠ: 'v',
    ᴡ: 'w',
    ʏ: 'y',
    ᴢ: 'z',
  };

  let inputEl: HTMLInputElement;

  function smallCapsSelection(el: HTMLInputElement) {
    const { selectionStart, selectionEnd } = el;
    const selection = el.value.slice(selectionStart, selectionEnd);
    const replacement = Array.from(selection)
      .map((character: string) => pairs[character] || character)
      .join('');
    return el.value.slice(0, selectionStart) + replacement + el.value.slice(selectionEnd);
  }

  function italicizeSelection(el: HTMLInputElement) {
    const { selectionStart, selectionEnd } = el;
    const selection = el.value.slice(selectionStart, selectionEnd);
    const replacement = selection.length ? `<i>${selection}</i>` : selection;
    return el.value.slice(0, selectionStart) + replacement + el.value.slice(selectionEnd);
  }
</script>

<form on:submit|preventDefault={save}>
  <div class="rounded-md shadow-sm">
    {#if field === 'nt'}
      {#await import('../editor/ClassicCustomized.svelte') then { default: ClassicCustomized }}
        <ClassicCustomized {editorConfig} bind:html={value} />
      {/await}
    {:else if field.startsWith('gl') || field.startsWith('xs')}
      <Keyman>
        <InputWrapper fixed bcp={field.split('.')[1]}>
          <input
            bind:this={inputEl}
            dir="ltr"
            type="text"
            required={field === 'lx'}
            use:autofocus
            bind:value
            class:sompeng={display === 'Sompeng-Mardir'}
            class="form-input block w-full pr-9" />
        </InputWrapper>
      </Keyman>
    {:else}
      <input
        bind:this={inputEl}
        dir="ltr"
        type="text"
        required={field === 'lx'}
        use:autofocus
        bind:value
        class="form-input block w-full" />
    {/if}

    {#if field === 'in'}
      <div class="mt-3 text-sm hidden md:block" />
      <Button
        class="mt-1"
        size="sm"
        form="simple"
        onclick={() => (value = smallCapsSelection(inputEl))}
        >Toggle sᴍᴀʟʟCᴀᴘs for selection</Button>
    {/if}

    {#if field.startsWith('gl')}
      <Button
        class="mt-1"
        size="sm"
        form="simple"
        onclick={() => (value = italicizeSelection(inputEl))}><i>Italicize</i> selection</Button>
      {#if value.indexOf('<i>') > -1}
        <div class="tw-prose mt-2 p-1 shadow bg-gray-200">
          {@html value}
        </div>
      {/if}
    {/if}
  </div>

  <div class="modal-footer">
    <Button onclick={close} form="simple" color="black">
      {t ? $t('misc.cancel') : 'Cancel'}
    </Button>
    <div class="w-1" />
    {#if adding}
      <Button type="submit" form="filled">
        {t ? $t('misc.next') : 'Next'}
        <i class="far fa-chevron-right rtl-x-flip" />
      </Button>
    {:else}
      <Button type="submit" form="filled">
        {t ? $t('misc.save') : 'Save'}
      </Button>
    {/if}
  </div>
</form>

<style>
  :global(.ck-editor__editable_inline) {
    --at-apply: md:min-h-50vh;
  }
</style>
