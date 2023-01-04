<script lang="ts">
  import InputWrapper from './InputWrapper.svelte';
  import Keyman from './Keyman.svelte';
  import { Story } from 'kitbook';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import Store from 'svelte-pieces/functions/Store.svelte';
  import ClassicCustomized from '@living-dictionaries/parts/src/lib/editor/ClassicCustomized.svelte';

  let value = '';
  let html = '';
</script>

<!-- prettier-ignore -->
# Keyman Keyboard

Keyman will accept an element (documentQuerySelector usable string or element itself) and if none is given then it will attach to the first child element it finds inside its slot. The slot method is used in the first two examples, and the target method is used for the CKEditor example because it's input component is nested multiple layers deep. 

<Story
  name="input - with option to change keyboard"
  knobs={{ bcp: 'am', show: false, canChooseKeyboard: true }}
  let:props={{ bcp, show, canChooseKeyboard }}
  let:set>
  <Keyman>
    <InputWrapper {bcp} {show} {canChooseKeyboard}>
      <input type="text" bind:value class="form-input block w-full" />
    </InputWrapper>
  </Keyman>
  <div>{value}</div>
  <div class="mt-2">
    Set to bcp without keyboard:
    <Button form="menu" size="sm" onclick={() => set('bcp', 'en')} active={'en' === bcp}
      >English (en)</Button>
  </div>
</Story>

<Story name="input - no language - can choose">
  <Keyman>
    <InputWrapper canChooseKeyboard>
      <input type="text" class="form-input block w-full" />
    </InputWrapper>
  </Keyman>
</Story>

<Story name="textarea - set to Assamese" knobs={{ buttonAtTop: true }} let:props={{ buttonAtTop }}>
  <div>
    <Store startWith="গিক" let:set let:store={paragraph}>
      <Keyman>
        <InputWrapper bcp="as" position={buttonAtTop ? 'top' : 'bottom'}>
          <textarea
            class="form-input w-full"
            value={paragraph}
            on:input={(e) => {
              // @ts-ignore
              set(e.target.value);
            }}
            rows="4" />
        </InputWrapper>
      </Keyman>
      <pre class="pl-3">{paragraph}</pre>
    </Store>
  </div>
</Story>

<Story name="CKEditor - set to Assamese">
  <div class="w-full">
    <Keyman>
      <InputWrapper bcp="as" target=".ck-editor__editable_inline" position="bottom">
        <ClassicCustomized bind:html />
      </InputWrapper>
    </Keyman>
    <pre class="pl-3">{html}</pre>
  </div>
</Story>

<Story name="CKEditor - no language - can choose">
  <div class="w-full">
    <Keyman>
      <InputWrapper canChooseKeyboard target=".ck-editor__editable_inline" position="bottom">
        <ClassicCustomized bind:html />
      </InputWrapper>
    </Keyman>
    <pre class="pl-3">{html}</pre>
  </div>
</Story>

<!-- prettier-ignore -->
## Notes

If ever needed, `InputWrapper` could be updated to allow passing in a targeted element.

### Useful Links

- [KeymanWeb docs](https://keyman.com/developer/keymanweb/)
- [KeymanWeb API](https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/)
- [Angular Setup](https://medium.com/@jwbowdoin/setup-on-screen-keyboards-in-over-1-000-languages-using-keyman-11-in-an-angular-7-web-app-3c3eb846585c)
