<script lang="ts">
  // https://help.keyman.com/DEVELOPER/engine/web/15.0/reference/
  import './keyman.css';
  import { onMount, setContext } from 'svelte';
  import { loadScriptOnce } from 'sveltefirets/helpers/loader';
  import { keymanKey, type keymanKeyContext } from './context';
  export let version = '16.0.114'; // beta version; latest stable is '15.0.269' https://keyman.com/downloads/pre-release/ && https://help.keyman.com/developer/engine/web/history
  let loaded = false;

  let kmw: any;
  setContext<keymanKeyContext>(keymanKey, { getKeyman: () => kmw });

  onMount(async () => {
    await loadScriptOnce(`https://s.keyman.com/kmw/engine/${version}/keymanweb.js`);

    // @ts-ignore;
    kmw = keyman;
    await kmw.init({
      attachType: 'manual',
    });
    loaded = true;
  });
</script>

{#if loaded}
  <slot {kmw} />
{/if}
