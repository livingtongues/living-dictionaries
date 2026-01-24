Keyman will accept an element (documentQuerySelector usable string or element itself) and if none is given then it will attach to the first child element it finds inside its slot. The slot method is used in the first two examples, and the target method is used for the CKEditor example because it's input component is nested multiple layers deep. 

### Useful Links

- [KeymanWeb docs](https://keyman.com/developer/keymanweb/)
- [KeymanWeb API](https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/)
- [Angular Setup](https://medium.com/@jwbowdoin/setup-on-screen-keyboards-in-over-1-000-languages-using-keyman-11-in-an-angular-7-web-app-3c3eb846585c)

## TODO: add back in compositions
<!-- input - no language - can choose
<Keyman canChooseKeyboard>
  <input type="text" class="form-input block w-full" />
</Keyman>

textarea
buttonAtTop: true
"গিক" paragraph
<Keyman bcp="as" position={buttonAtTop ? 'top' : 'bottom'}>
  <textarea
    class="form-input w-full"
    value={paragraph}
    on:input={(e) => {
      // @ts-ignore
      set(e.target.value);
    }}
    rows="4" />
</Keyman>
<pre class="pl-3">{paragraph}</pre>


CKEditor
<div class="w-full">
  <Keyman bcp="as" target=".ck-editor__editable_inline" position="bottom">
    <ClassicCustomized {html} on_update={(detail) => (html = detail)} />
  </Keyman>
  <pre class="pl-3">{html}</pre>
</div>

CKEditor - no language - can choose
<div class="w-full">
  <Keyman canChooseKeyboard target=".ck-editor__editable_inline" position="bottom">
    <ClassicCustomized {html} on_update={(detail) => (html = detail)} />
  </Keyman>
  <pre class="pl-3">{html}</pre>
</div> -->
