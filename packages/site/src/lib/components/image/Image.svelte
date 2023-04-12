<script lang="ts">
  import { t } from 'svelte-i18n';
  import { crossfade, scale } from 'svelte/transition';
  import { Button } from 'svelte-pieces';
  import { createEventDispatcher } from 'svelte';
  
  export let lexeme: string;
  export let gcs: string;
  export let canEdit = false;
  export let square: number = undefined;
  export let width: number = undefined;
  export let height: number = undefined;

  const [send, receive] = crossfade({
    duration: 200,
    fallback: scale,
  });
  let w: number;
  let loading = false;
  let viewing = false;

  $: src = `https://lh3.googleusercontent.com/${gcs}=w${w >= 768 ? w - 24 : w}`;

  function load() {
    const timeout = setTimeout(() => (loading = true), 100);
    const img = new Image();

    img.onload = () => {
      clearTimeout(timeout);
      loading = false;
      viewing = true;
    };

    img.src = src;
  }
  const key = {};

  const dispatch = createEventDispatcher<{
    deleteImage: boolean;
  }>();
</script>

{#if !viewing}
  <div class="h-full w-full relative">
    <img
      class="h-full w-full object-cover cursor-pointer"
      on:click={load}
      in:receive|local={{ key }}
      out:send|local={{ key }}
      alt=""
      src="https://lh3.googleusercontent.com/{gcs}={square
        ? `s${square}-p`
        : width
        ? `w${width}`
        : height
        ? `h${height}`
        : 's0'}" />
    {#if loading}
      <span class="i-gg-spinner animate-spin absolute bottom-1 right-1 text-white" />
    {/if}
  </div>
{/if}

<div class="fixed left-0 right-0 top-0" style="height: 1px;" bind:clientWidth={w} />

{#if viewing}
  <div
    on:click={() => {
      viewing = false;
    }}
    class="fixed inset-0 md:p-3 flex flex-col items-center justify-center"
    in:receive={{ key }}
    out:send={{ key }}
    style="background: rgba(0, 0, 0, 0.85); z-index: 51; will-change: transform;">
    <div class="h-full flex flex-col justify-center">
      <div
        class="font-semibold text-white p-4 flex justify-between items-center
          absolute top-0 inset-x-0 bg-opacity-25 bg-black">
        <span on:click|stopPropagation>{lexeme}</span>
        <span class="i-fa-solid-times p-3 cursor-pointer" />
      </div>
      <img class="object-contain max-h-full" alt="Image of {lexeme}" {src} />
      {#if canEdit}
        <div
          class="p-4 flex justify-between
            items-center absolute bottom-0 inset-x-0 bg-opacity-25 bg-black">
          <Button
          class="ml-auto"
            color="red"
            form="filled"
            onclick={(e) => {
              e.stopPropagation();
              dispatch('deleteImage');
            }}>
            <span class="i-fa-trash-o" style="margin: -1px 0 2px;" />
            {$t('misc.delete', { default: 'Delete' })}
          </Button>
        </div>
      {/if}
    </div>
  </div>
{/if}
