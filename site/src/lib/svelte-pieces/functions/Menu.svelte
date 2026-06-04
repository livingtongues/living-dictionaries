<script> import { fly } from 'svelte/transition'
import { portal } from '../actions/portal'
import { clickoutside } from '../actions/clickoutside'

export let portalTarget = void 0
export let onclickoutside = void 0
</script>

{#if portalTarget}
  <div
    use:portal={portalTarget}
    use:clickoutside
    on:clickoutside={onclickoutside}
    transition:fly={{ y: -10, duration: 150 }}
    class="sp-d8trwd {$$props.class}">
    <div class="sv-menu">
      <slot />
    </div>
  </div>
{:else}
  <div
    use:clickoutside
    on:clickoutside={onclickoutside}
    transition:fly={{ y: -10, duration: 150 }}
    class="sp-d8trwd {$$props.class}">
    <div class="sv-menu">
      <slot />
    </div>
  </div>
{/if}

<style>:global(.sp-d8trwd){position:absolute;z-index:30;margin-top:0.5rem;width:12rem;border-radius:0.375rem;--un-shadow:var(--un-shadow-inset) 0 10px 15px -3px var(--un-shadow-color, rgb(0 0 0 / 0.1)),var(--un-shadow-inset) 0 4px 6px -4px var(--un-shadow-color, rgb(0 0 0 / 0.1));box-shadow:var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow);}
  .sv-menu {
    display:flex;flex-direction:column;border-radius:0.375rem;--un-bg-opacity:1;background-color:rgb(255 255 255 / var(--un-bg-opacity));padding-top:0.25rem;padding-bottom:0.25rem;
  }
  :global(.sv-menu a),
  :global(.sv-menu label),
  :global(.sv-menu button) {
    padding-left:1rem;padding-right:1rem;padding-top:0.5rem;padding-bottom:0.5rem;text-align:left;font-size:0.875rem;line-height:1.25rem;--un-text-opacity:1;color:rgb(55 65 81 / var(--un-text-opacity));transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms;transition-duration:150ms;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);
  }:global(.sv-menu a):hover, :global(.sv-menu label):hover, :global(.sv-menu button):hover{--un-bg-opacity:1;background-color:rgb(243 244 246 / var(--un-bg-opacity));}
</style>
