<script lang="ts">
  // https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/
  import './keyman.css';
  import { onMount } from 'svelte';
  import { loadScriptOnce } from 'sveltefirets/client/loader';
  import { glossingLanguages } from '../../../glosses/glossing-languages';
  export let version = '16.0.59'; // alpha; latest stable is '15.0.269'
  let languages = ['am', 'en', 'ar', 'as'];
  let currentLanguage = 'as';
  let value: '';
  let showKeyboard = true;

  let kmw: any;
  let el: HTMLInputElement;

  onMount(async () => {
    await loadScriptOnce(`https://s.keyman.com/kmw/engine/${version}/keymanweb.js`);

    // @ts-ignore;
    kmw = keyman;
    await kmw.init({
      attachType: 'manual', // auto
    });

    if (!kmw.util.isTouchDevice()) {
      document.body.classList.add('kmw-is-desktop');
    }

    for (const language of languages) {
      const internalName = glossingLanguages[language] && glossingLanguages[language].internalName;
      const keyboard = (internalName && `${internalName}@${language}`) || `@${language}`;

      await kmw.addKeyboards(keyboard); //https://help.keyman.com/DEVELOPER/engine/web/13.0/reference/core/addKeyboards
      if (internalName && language === currentLanguage) {
        kmw.attachToControl(el);
        kmw.setKeyboardForControl(el, internalName, language);
        // https://help.keyman.com/DEVELOPER/engine/web/13.0/reference/core/setKeyboardForControl
      }
    }
    // console.log({ list: kmw.getKeyboards() });
  });
</script>

<pre>
  <!-- {JSON.stringify(kmw, null, 1)} -->
</pre>

{#if kmw}
  <slot {kmw} />
{/if}

<div class="flex items-center my-2">
  <input
    bind:this={el}
    class="border shadow px-3 py-1 block mr-1"
    bind:value
    class:kmw-disabled={!showKeyboard} />
  <button type="button" on:click={() => (showKeyboard = !showKeyboard)}
    >Toggle <i class="far fa-keyboard" />
  </button>

  <div id="KeymanWebControl" />
  {value}
</div>
