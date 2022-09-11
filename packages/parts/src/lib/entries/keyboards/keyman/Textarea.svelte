<script lang="ts">
  // https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/
  import { getContext, onMount } from 'svelte';
  import { glossingLanguages } from '../../../glosses/glossing-languages';
  import { keymanKey, type keymanKeyContext } from './context';

  export let bcp: string;
  export let value: string;
  export let showKeyboard = true;

  const { getKeyman } = getContext<keymanKeyContext>(keymanKey);
  const kmw = getKeyman();

  let el: HTMLTextAreaElement;
  onMount(async () => {
    const internalName = glossingLanguages[bcp] && glossingLanguages[bcp].internalName;
    const keyboard = (internalName && `${internalName}@${bcp}`) || `@${bcp}`;

    await kmw.addKeyboards(keyboard);
    if (internalName) {
      kmw.attachToControl(el);
      kmw.setKeyboardForControl(el, internalName, bcp);
    }
  });
</script>

<textarea
  type="text"
  bind:this={el}
  class="border shadow px-3 py-1 block mr-1"
  bind:value
  class:kmw-disabled={!showKeyboard} />
<button type="button" on:click={() => (showKeyboard = !showKeyboard)}
  >Toggle <i class="far fa-keyboard" />
</button>
