<script lang="ts">
  import { onMount } from 'svelte';

  let progress = 0;
  let visible = false;

  onMount(() => {
    function next() {
      visible = true;
      progress += 0.1;
      const remaining = 1 - progress;
      if (remaining > 0.15) setTimeout(next, 500 / remaining);
    }
    setTimeout(next, 250);
  });
</script>

{#if visible}
  <div class="progress-container">
    <div class="progress" style="width: {progress * 100}%" />
  </div>
{/if}

<style>
  .progress-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    z-index: 999;
  }
  .progress {
    height: 100%;
    --loading-bar: #5850ec;
    background-color: var(--loading-bar);
    transition: width 0.4s;
  }
</style>
