<script lang="ts">
  import { page } from '$app/state'

  const auth_user = $derived(page.data.auth_user)
</script>

{#if auth_user?.previewing}
  <!-- Bottom-RIGHT, above the toast layer (toasts-root is z-500, bottom full-width centered): keeps
       the pill clear of centered toasts and keeps Exit always clickable. Hidden below sm — preview
       is a deliberate desktop admin action. -->
  <div class="preview-pill">
    <span class="dot"></span>
    <span>Previewing as <strong>{auth_user.preview_label}</strong></span>
    <button
      type="button"
      onclick={() => auth_user.exit_preview()}
      class="exit-button">
      Exit
    </button>
  </div>
{/if}

<style>
  .preview-pill {
    display: none;
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 501;
    align-items: center;
    gap: 0.75rem;
    border-radius: 9999px;
    background-color: rgb(31 41 55); /* gray-800 — a deliberately dark pill in both modes */
    color: #fff;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  }

  @media (min-width: 640px) {
    .preview-pill {
      display: flex;
    }
  }

  @media print {
    .preview-pill {
      display: none;
    }
  }

  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 9999px;
    background-color: rgb(251 191 36); /* amber-400 */
    flex-shrink: 0;
  }

  .exit-button {
    border-radius: 0.375rem;
    background-color: rgb(255 255 255 / 0.15);
    padding: 0.125rem 0.5rem;
    flex-shrink: 0;
  }

  .exit-button:hover {
    background-color: rgb(255 255 255 / 0.25);
  }

  .exit-button:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
  }
</style>
