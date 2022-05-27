<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IEntry } from '@living-dictionaries/types';
  import DeleteButton from '../media/DeleteButton.svelte';
  export let entry: IEntry,
    canEdit = false,
    square: number = undefined,
    width: number = undefined,
    height: number = undefined;
  import { crossfade, scale } from 'svelte/transition';
  const [send, receive] = crossfade({
    duration: 200,
    fallback: scale,
  });
  let w;
  let loading = false;
  let viewing = false;

  $: src = `https://lh3.googleusercontent.com/${entry.pf.gcs}=w${w >= 768 ? w - 24 : w}`;

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

  import { deleteImage } from '$lib/helpers/delete';
</script>

{#if !viewing}
  <img
    class="h-full w-full object-cover cursor-pointer"
    on:click={load}
    in:receive|local={{ key: entry.id }}
    out:send|local={{ key: entry.id }}
    alt=""
    src="https://lh3.googleusercontent.com/{entry.pf.gcs}={square
      ? `s${square}-p`
      : width
      ? `w${width}`
      : height
      ? `h${height}`
      : 's0'}" />
  {#if loading}
    <i class="far fa-spinner fa-pulse absolute bottom-3 right-3 text-white" />
  {/if}
{/if}

<div class="fixed left-0 right-0 top-0" style="height: 1px;" bind:clientWidth={w} />

{#if viewing}
  <div
    on:click={() => {
      viewing = false;
    }}
    class="fixed inset-0 md:p-3 flex flex-col items-center justify-center"
    in:receive={{ key: entry.id }}
    out:send={{ key: entry.id }}
    style="background: rgba(0, 0, 0, 0.85); z-index: 51; will-change: transform;">
    <div class="h-full flex flex-col justify-center">
      <div
        class="font-semibold text-white p-4 flex justify-between items-center
          absolute top-0 inset-x-0 bg-opacity-25 bg-black">
        <span on:click|stopPropagation>{entry.lx}</span>
        <i class="far fa-times p-3 cursor-pointer" />
      </div>
      <img class="object-contain max-h-full" alt="Image of {entry.lx}" {src} />
      {#if canEdit}
        <DeleteButton action={() => deleteImage(entry)} />
      {/if}
    </div>
  </div>
{/if}
