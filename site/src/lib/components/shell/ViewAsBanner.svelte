<script lang="ts">
  import { page } from '$app/state'

  const auth_user = $derived(page.data.auth_user)
</script>

{#if auth_user?.previewing}
  <!-- Bottom-RIGHT, above the toast layer (toasts-root is z-500, bottom full-width centered): keeps
       the pill clear of centered toasts and keeps Exit always clickable. Hidden below sm — preview
       is a deliberate desktop admin action. -->
  <div
    class="hidden sm:flex fixed bottom-4 right-4 z-[501] items-center gap-3
      rounded-full bg-gray-800 text-white px-4 py-2 text-sm shadow-lg print:hidden">
    <span class="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span>
    <span>Previewing as <strong>{auth_user.preview_label}</strong></span>
    <button
      type="button"
      onclick={() => auth_user.exit_preview()}
      class="rounded-md bg-white/15 hover:bg-white/25 px-2 py-0.5 focus:outline-none flex-shrink-0">
      Exit
    </button>
  </div>
{/if}
