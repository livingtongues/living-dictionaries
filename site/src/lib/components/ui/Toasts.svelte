<script lang="ts">
  import type { Toast } from '$lib/state/toast.svelte'
  import { backOut } from 'svelte/easing'
  import { fade, fly } from 'svelte/transition'

  import { toasts } from '$lib/state/toast.svelte'

  function get_theme_classes(theme: Toast['theme']) {
    if (theme === 'red') {
      return 'red-theme'
    }
    if (theme === 'green') {
      return 'green-theme'
    }
    return 'black-theme'
  }

  const reversed = $derived([...toasts.items].reverse())
</script>

<div class="toasts-root">
  {#each reversed as toast_item (toast_item.id)}
    <div
      class={['toast-item', get_theme_classes(toast_item.theme)]}
      in:fly={{ delay: 0, duration: 300, x: 0, y: 50, opacity: 0.1, easing: backOut }}
      out:fade={{ duration: 500 }}>
      <div class="toast-row">
        <div class="toast-message">{toast_item.message}</div>
        {#if toast_item.dismiss_label || toast_item.action}
          <div class="toast-actions">
            {#if toast_item.action}
              <button
                type="button"
                onclick={() => {
                  toast_item.action?.callback()
                  toasts.remove(toast_item.id)
                }}
                class="toast-btn">
                {toast_item.action.label}
              </button>
            {/if}
            {#if toast_item.dismiss_label}
              <button type="button" class="toast-btn" onclick={() => toasts.remove(toast_item.id)}>
                {toast_item.dismiss_label}
              </button>
            {/if}
          </div>
        {/if}
      </div>
      {#if toast_item.progress !== undefined}
        <div class="toast-progress-track">
          <div
            style="width:{toast_item.progress}%"
            class="toast-progress-bar">
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toasts-root {
    position: fixed;
    z-index: 500;
    left: 0.5rem;
    right: 0.5rem;
    bottom: 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .toast-item {
    margin-top: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    max-width: 24rem;
  }
  .toast-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .toast-message {
    flex: 1;
    white-space: pre-line;
  }
  .toast-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .toast-progress-track {
    overflow: hidden;
    height: 0.5rem;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    display: flex;
    border-radius: 0.25rem;
    background: rgb(0 0 0 / 0.3);
  }
  .toast-progress-bar {
    box-shadow: none;
    display: flex;
    flex-direction: column;
    text-align: center;
    white-space: nowrap;
    justify-content: center;
    background: var(--primary);
    transition: width 0.5s ease;
  }
  .red-theme {
    background-color: var(--danger);
    color: white;
  }
  .green-theme {
    background-color: var(--success);
    color: white;
  }
  .black-theme {
    background-color: var(--color);
    color: var(--background);
  }
  /* Buttons inside the toast inherit the toast's foreground color so they
     stay visible on any theme background. */
  .toast-btn {
    color: inherit;
    background: color-mix(in srgb, transparent, currentColor 12%);
    border-radius: 9999px;
    padding: 4px 12px;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25rem;
    transition: background-color 0.15s;
  }
  .toast-btn:hover {
    background: color-mix(in srgb, transparent, currentColor 22%);
  }
  .toast-btn:active {
    transform: scale(0.96);
  }
</style>
