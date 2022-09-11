<script lang="ts">
  // https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/
  import './keyman.css';
  import { onMount, setContext } from 'svelte';
  import { loadScriptOnce } from 'sveltefirets/client/loader';
  import { keymanKey, type keymanKeyContext } from './context';
  export let version = '16.0.59'; // alpha; latest stable is '15.0.269'
  let loaded = false;

  let kmw: any;
  setContext<keymanKeyContext>(keymanKey, { getKeyman: () => kmw });

  onMount(async () => {
    await loadScriptOnce(`https://s.keyman.com/kmw/engine/${version}/keymanweb.js`);

    // @ts-ignore;
    kmw = keyman;
    await kmw.init({
      attachType: 'manual', // auto
    });
    loaded = true;

    if (!kmw.util.isTouchDevice()) {
      document.body.classList.add('kmw-is-desktop');
    }
  });
</script>

{#if loaded}
  <slot {kmw} />
{/if}
