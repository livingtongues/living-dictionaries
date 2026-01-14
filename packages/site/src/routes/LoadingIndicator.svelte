<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let progress = $state(0);
  let visible = $state(false);

   let timeoutId: ReturnType<typeof setTimeout>;

   onMount(() => {
     function next() {
       visible = true;
       progress += Math.min(0.05, 1 - progress);
       if (progress < 1) {
         timeoutId = setTimeout(next, Math.max(50, 200 / (1 - progress)));
       }
     }
     setTimeout(next, 250);
   });

   onDestroy(() => {
     if (timeoutId) clearTimeout(timeoutId);
     progress = 1;
     setTimeout(() => visible = false, 200);
   });
</script>

{#if visible}
  <div class="progress-container">
    <div class="progress" style="width: {progress * 100}%"></div>
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
