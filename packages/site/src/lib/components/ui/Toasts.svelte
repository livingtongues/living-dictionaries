<script lang="ts">
  import { backOut } from 'svelte/easing'
  import { fade, fly } from 'svelte/transition'
  import { type Toast, toasts } from './toast'

  function get_theme_classes(theme: Toast['theme']) {
    if (theme === 'red') {
      return 'red-theme'
    }
    if (theme === 'green') {
      return 'green-theme'
    }
    return 'black-theme'
  }
</script>

<div class="fixed z-500 inset-x-2 bottom-2 flex flex-col items-center">
  {#each $toasts.slice().reverse() as toast_item (toast_item.id)}
    <div
      class="{get_theme_classes(toast_item.theme)} text-white mt-2 px-3 py-2 rounded max-w-sm"
      in:fly={{ delay: 0, duration: 300, x: 0, y: 50, opacity: 0.1, easing: backOut }}
      out:fade={{ duration: 500 }}>
      <div class="flex items-center justify-between gap-2">
        <div class="flex-1 whitespace-pre-line">{toast_item.message}</div>
        {#if toast_item.dismiss_label}
          <button
            type="button"
            class="text-white underline text-sm shrink-0"
            onclick={() => toasts.remove(toast_item.id)}>
            {toast_item.dismiss_label}
          </button>
        {/if}
      </div>
      {#if toast_item.progress !== undefined}
        <div class="overflow-hidden h-2 mt-2 flex rounded bg-gray-700">
          <div
            style="width:{toast_item.progress}%"
            class="flex flex-col justify-center bg-blue-500 transition-[width] duration-500 ease"></div>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .red-theme {
    @apply bg-red-600 bg-opacity-90;
  }
  .green-theme {
    @apply bg-green-600 bg-opacity-90;
  }
  .black-theme {
    @apply bg-black bg-opacity-75;
  }
</style>
