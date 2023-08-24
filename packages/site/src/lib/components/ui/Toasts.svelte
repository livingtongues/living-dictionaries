<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { backOut } from 'svelte/easing';

  let toasts = [];
  const retainMs = 2000;

  let toastId = 0;
  const pushToast = (msg = '') => {
    toasts = [
      ...toasts,
      {
        _id: ++toastId,
        msg,
      },
    ];
    setTimeout(() => {
      unshiftToast();
    }, retainMs);
  };

  const unshiftToast = () => {
    toasts = toasts.filter((a, i) => i > 0);
  };

  onMount(() => {
    //@ts-ignore
    window.pushToast = pushToast;
  });
</script>

<div class="fixed z-50 inset-x-0 bottom-0 flex flex-col items-center p-2">
  {#each toasts as toast (toast._id)}
    <div
      class="bg-black bg-opacity-75 text-white mt-2 p-3 rounded max-w-sm"
      in:fly={{ delay: 0, duration: 300, x: 0, y: 50, opacity: 0.1, easing: backOut }}
      out:fade={{ duration: 500 }}>
      {toast.msg}
    </div>
  {/each}
</div>
<!-- Look at https://github.com/beyonk-adventures/svelte-notifications also -->
