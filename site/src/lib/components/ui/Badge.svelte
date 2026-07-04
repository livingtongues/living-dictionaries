<script>
  let {
    onclick = undefined,
    onx = undefined,
    href = undefined,
    target = '',
    size = 'sm',
    color = undefined,
    active = false,
    class: klass = '',
    children,
  } = $props()
</script>

{#if href}
  <a {href} {target} rel="noopener noreferrer" data-sveltekit-prefetch class:active class="{klass} {size} {color}">
    {@render children?.()}
    {#if onx}
      <span class="x-gap"></span>
      <button type="button" onclick={(event) => { event.preventDefault(); onx(event) }} class="badge-x">
        <svg class="x-icon" stroke="currentColor" fill="none" viewBox="0 0 8 8">
          <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
        </svg>
      </button>
    {:else if target === '_blank'}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="external-icon"
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
  <button type="button" {onclick} class:active class="{klass} {size} {color}">
    {@render children?.()}
    {#if onx}
      <span class="x-gap"></span>
      <button type="button" onclick={(event) => { event.stopPropagation(); onx(event) }} class="badge-x">
        <svg class="x-icon" stroke="currentColor" fill="none" viewBox="0 0 8 8">
          <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
        </svg>
      </button>
    {/if}
  </button>
{:else}
  <div class:active class="{klass} {size} {color}">
    {@render children?.()}
    {#if onx}
      <span class="x-gap"></span>
      <button type="button" onclick={onx} class="badge-x">
        <svg class="x-icon" stroke="currentColor" fill="none" viewBox="0 0 8 8">
          <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
        </svg>
      </button>
    {/if}
  </div>
{/if}

<style>
  .external-icon {
    margin-left: 0.25rem;
    display: inline;
    height: 1rem;
    width: 1rem;
  }

  .x-gap {
    width: 0.5rem;
  }

  .x-icon {
    height: 0.5rem;
    width: 0.5rem;
  }

  a,
  button:not(.badge-x),
  div {
    display: inline-flex;
    align-items: center;
    border-radius: 0.375rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 500;
    background-color: rgb(219 234 254); /* blue-100 */
    color: rgb(30 64 175); /* blue-800 */
  }

  .red {
    background-color: rgb(254 226 226);
    color: rgb(153 27 27);
  }

  .orange {
    background-color: rgb(255 237 213);
    color: rgb(154 52 18);
  }

  .green {
    background-color: rgb(220 252 231);
    color: rgb(22 101 52);
  }

  .gray {
    background-color: rgb(243 244 246);
    color: rgb(31 41 55);
  }

  .badge-x {
    color: rgb(96 165 250);
    margin-left: -0.25rem;
    margin-right: -0.25rem;
    height: 1rem;
    width: 1rem;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
  }

  .badge-x:hover {
    background-color: rgb(191 219 254);
    color: rgb(59 130 246);
  }

  .badge-x:focus {
    background-color: rgb(59 130 246);
    color: rgb(255 255 255);
    outline: 2px solid transparent;
    outline-offset: 2px;
  }

  .red .badge-x {
    color: rgb(248 113 113);
  }

  .red .badge-x:hover {
    background-color: rgb(254 202 202);
    color: rgb(239 68 68);
  }

  .red .badge-x:focus {
    background-color: rgb(239 68 68);
    color: rgb(255 255 255);
  }

  .orange .badge-x {
    color: rgb(251 146 60);
  }

  .orange .badge-x:hover {
    background-color: rgb(254 215 170);
    color: rgb(249 115 22);
  }

  .orange .badge-x:focus {
    background-color: rgb(249 115 22);
    color: rgb(255 255 255);
  }

  .green .badge-x {
    color: rgb(74 222 128);
  }

  .green .badge-x:hover {
    background-color: rgb(187 247 208);
    color: rgb(34 197 94);
  }

  .green .badge-x:focus {
    background-color: rgb(34 197 94);
    color: rgb(255 255 255);
  }

  .gray .badge-x {
    color: rgb(156 163 175);
  }

  .gray .badge-x:hover {
    background-color: rgb(229 231 235);
    color: rgb(107 114 128);
  }

  .gray .badge-x:focus {
    background-color: rgb(107 114 128);
    color: rgb(255 255 255);
  }
</style>
