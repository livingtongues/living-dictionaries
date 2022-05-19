<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  let waiting = false;
  let timeout = null;
  export let delay = 600;

  function handleClickType() {
      if (waiting) {
          clearTimeout(timeout);
          dispatch('dblclick');
          waiting = false;
          return;
      }
      waiting = true;
      timeout = setTimeout(() => {
          dispatch('sglclick');
          waiting = false;
      }, delay);
  }
</script>

<button on:click={handleClickType}>
  <slot />
</button>