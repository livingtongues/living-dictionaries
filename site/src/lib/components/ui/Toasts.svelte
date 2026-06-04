<script module lang="ts">
  import { writable } from 'svelte/store'

  interface IToast {
    message: string
    id?: number
  }

  function createToastsStore() {
    const { subscribe, update } = writable<IToast[]>([])
    return {
      subscribe,
      push: (toast: IToast) => update(toasts => [...toasts, toast]),
      remove: (id: number) => update(toasts => toasts.filter(toast => toast.id !== id)),
    }
  }
  const toasts = createToastsStore()

  export function toast(message: string, duration = 2500) {
    const id = Date.now()
    toasts.push({
      id,
      message,
    })
    setTimeout(() => {
      toasts.remove(id)
    }, duration)
  }
</script>

<script lang="ts">
  import { backOut } from 'svelte/easing'
  import { fade, fly } from 'svelte/transition'
</script>

<div class="fixed z-500 inset-x-2 bottom-2 flex flex-col items-center">
  {#each $toasts as toast (toast.id)}
    <div
      class="bg-black bg-opacity-75 text-white mt-2 px-3 py-2 rounded max-w-sm"
      in:fly={{ delay: 0, duration: 300, x: 0, y: 50, opacity: 0.1, easing: backOut }}
      out:fade={{ duration: 500 }}>
      {toast.message}
    </div>
  {/each}
</div>

<!-- Look at https://github.com/beyonk-adventures/svelte-notifications to improve -->
