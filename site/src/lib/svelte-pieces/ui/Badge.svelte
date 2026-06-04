<script> export let onclick = void 0
export let onx = void 0
export let href = void 0
export let target = ''
export let size = 'sm'
export let color = void 0
export let active = false
</script>

{#if href}
  <a {href} {target} rel="noopener noreferrer" data-sveltekit-prefetch class:active class="{$$props.class} {size} {color}">
    <slot />
    {#if onx}
      <span class="sp-7gktzh" />
      <button type="button" on:click|preventDefault={onx} class="badge-x">
        <svg class="sp-toedj4" stroke="currentColor" fill="none" viewBox="0 0 8 8">
          <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
        </svg>
      </button>
    {:else if target === '_blank'}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="sp-tvsgvk"
        viewBox="0 0 20 20"
        fill="currentColor">
        <path
          d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
        <path
          d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
      </svg>
    {/if}
  </a>
{:else if onclick}
  <button type="button" on:click={onclick} class:active class="{$$props.class} {size} {color}">
    <slot />
    {#if onx}
      <span class="sp-7gktzh" />
      <button type="button" on:click|stopPropagation={onx} class="badge-x">
        <svg class="sp-toedj4" stroke="currentColor" fill="none" viewBox="0 0 8 8">
          <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
        </svg>
      </button>
    {/if}
  </button>
{:else}
  <div class:active class="{$$props.class} {size} {color}">
    <slot />
    {#if onx}
      <span class="sp-7gktzh" />
      <button type="button" on:click={onx} class="badge-x">
        <svg class="sp-toedj4" stroke="currentColor" fill="none" viewBox="0 0 8 8">
          <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
        </svg>
      </button>
    {/if}
  </div>
{/if}

<style>:global(.sp-tvsgvk){margin-left:0.25rem;display:inline;height:1rem;width:1rem;}:global(.sp-7gktzh){width:0.5rem;}:global(.sp-toedj4){height:0.5rem;width:0.5rem;}
  a,
  button:not(.badge-x),
  div {
    display:inline-flex;align-items:center;border-radius:0.375rem;padding-top:0.25rem;padding-bottom:0.25rem;padding-left:0.5rem;padding-right:0.5rem;font-size:0.75rem;line-height:1rem;font-weight:500;
    --un-bg-opacity:1;background-color:rgb(219 234 254 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(30 64 175 / var(--un-text-opacity));
  }
  .red {
    --un-bg-opacity:1;background-color:rgb(254 226 226 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(153 27 27 / var(--un-text-opacity));
  }
  .orange {
    --un-bg-opacity:1;background-color:rgb(255 237 213 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(154 52 18 / var(--un-text-opacity));
  }
  .green {
    --un-bg-opacity:1;background-color:rgb(220 252 231 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(22 101 52 / var(--un-text-opacity));
  }
  .gray {
    --un-bg-opacity:1;background-color:rgb(243 244 246 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(31 41 55 / var(--un-text-opacity));
  }
  .badge-x {
    --un-text-opacity:1;color:rgb(96 165 250 / var(--un-text-opacity));
    margin-left:-0.25rem;margin-right:-0.25rem;height:1rem;width:1rem;display:inline-flex;flex-shrink:0;align-items:center;justify-content:center;border-radius:9999px;
  }.badge-x:hover{--un-bg-opacity:1;background-color:rgb(191 219 254 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(59 130 246 / var(--un-text-opacity));}.badge-x:focus{--un-bg-opacity:1;background-color:rgb(59 130 246 / var(--un-bg-opacity));}.badge-x:focus{--un-text-opacity:1;color:rgb(255 255 255 / var(--un-text-opacity));outline:2px solid transparent;outline-offset:2px;}
  .red .badge-x {
    --un-text-opacity:1;color:rgb(248 113 113 / var(--un-text-opacity));
  }.red .badge-x:hover{--un-bg-opacity:1;background-color:rgb(254 202 202 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(239 68 68 / var(--un-text-opacity));}.red .badge-x:focus{--un-bg-opacity:1;background-color:rgb(239 68 68 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(255 255 255 / var(--un-text-opacity));}
  .orange .badge-x {
    --un-text-opacity:1;color:rgb(251 146 60 / var(--un-text-opacity));
  }.orange .badge-x:hover{--un-bg-opacity:1;background-color:rgb(254 215 170 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(249 115 22 / var(--un-text-opacity));}.orange .badge-x:focus{--un-bg-opacity:1;background-color:rgb(249 115 22 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(255 255 255 / var(--un-text-opacity));}
  .green .badge-x {
    --un-text-opacity:1;color:rgb(74 222 128 / var(--un-text-opacity));
  }.green .badge-x:hover{--un-bg-opacity:1;background-color:rgb(187 247 208 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(34 197 94 / var(--un-text-opacity));}.green .badge-x:focus{--un-bg-opacity:1;background-color:rgb(34 197 94 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(255 255 255 / var(--un-text-opacity));}
  .gray .badge-x {
    --un-text-opacity:1;color:rgb(156 163 175 / var(--un-text-opacity));
  }.gray .badge-x:hover{--un-bg-opacity:1;background-color:rgb(229 231 235 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(107 114 128 / var(--un-text-opacity));}.gray .badge-x:focus{--un-bg-opacity:1;background-color:rgb(107 114 128 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(255 255 255 / var(--un-text-opacity));}
</style>
