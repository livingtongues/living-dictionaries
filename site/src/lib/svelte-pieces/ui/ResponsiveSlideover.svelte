<script>import Slideover from "./Slideover.svelte";
export let zIndex = 60;
export let duration = 200;
export let side = "right";
export let widthRem = 16;
export let maxWidthPercentage = 70;
export let showWidth;
export let desktopClasses = "";
export let mobileClasses = "";
export let open = false;
export let on_close = void 0;
</script>

<div
  class:sp-qllz92={showWidth === 'sm'}
  class:sp-nrzatl={showWidth === 'md'}
  class:sp-0dkduh={showWidth === 'lg'}
  class:sp-hvht9m={showWidth === 'xl'}
  class="sp-zmjiff {desktopClasses}"
>
  {#if $$slots.desktopTitle}
    <h3 class="sp-i7iidx">
      <slot name="desktopTitle" />
    </h3>
  {/if}
  <slot name="desktopHeading" />
  <slot name="heading" />
  <slot />
  <!-- <slot name="desktop" /> -->
</div>

{#if open}
  <div
    class:sp-50t8dd={showWidth === 'sm'}
    class:sp-i2kcv6={showWidth === 'md'}
    class:sp-ni7hsi={showWidth === 'lg'}
    class:sp-s0n6gx={showWidth === 'xl'}
    class="sp-zmjiff {mobileClasses}"
  >
    <Slideover
      {duration}
      {zIndex}
      {side}
      {widthRem}
      {maxWidthPercentage}
      on:close={on_close}
    >
      <svelte:fragment slot="heading">
        {#if $$slots.mobileTitle}
          <div class="sp-serhln">
            <h3 class="sp-1qujs0" id="modal-headline">
              <slot name="mobileTitle" />
            </h3>
            <button
              on:click={on_close}
              type="button"
              class="sp-7muc4a"
              aria-label="Close"
            >
              <span class="sp-gb3q14" /></button
            >
          </div>
        {/if}
        <slot name="mobileHeading" />
        <slot name="heading" />
      </svelte:fragment>
      <slot />
      <!-- <slot name="mobile" /> -->
    </Slideover>
  </div>
{/if}

<style>:global(.sp-gb3q14){--un-icon:url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 352 512' display='inline-block' vertical-align='middle' width='1em' height='1em' xmlns='http://www.w3.org/2000/svg' %3E%3Cpath fill='currentColor' d='m242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28L75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256L9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48z'/%3E%3C/svg%3E");-webkit-mask:var(--un-icon) no-repeat;mask:var(--un-icon) no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%;background-color:currentColor;color:inherit;display:inline-block;vertical-align:middle;width:1em;height:1em;font-size:1.125rem;line-height:1.75rem;}:global(.sp-zmjiff){display:none;}:global(.sp-7muc4a){display:flex;padding-left:0.75rem;padding-right:0.75rem;padding-top:1rem;padding-bottom:1rem;--un-text-opacity:1;color:rgb(156 163 175 / var(--un-text-opacity));transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms;}:global(.sp-serhln){display:flex;align-items:flex-start;justify-content:space-between;border-bottom-width:1px;--un-border-opacity:1;border-color:rgb(209 213 219 / var(--un-border-opacity));}:global(.sp-i7iidx){border-bottom-width:1px;--un-border-opacity:1;border-color:rgb(209 213 219 / var(--un-border-opacity));padding:0.75rem;font-size:1.125rem;line-height:1.75rem;--un-text-opacity:1;color:rgb(17 24 39 / var(--un-text-opacity));font-weight:500;}:global(.sp-1qujs0){padding:0.75rem;font-size:1.125rem;line-height:1.75rem;--un-text-opacity:1;color:rgb(17 24 39 / var(--un-text-opacity));font-weight:500;}:global(.sp-7muc4a:hover){--un-text-opacity:1;color:rgb(107 114 128 / var(--un-text-opacity));}:global(.sp-7muc4a:focus){--un-text-opacity:1;color:rgb(107 114 128 / var(--un-text-opacity));outline:2px solid transparent;outline-offset:2px;}@media (max-width: 1279.9px){:global(.sp-s0n6gx){display:block;}}@media (max-width: 1023.9px){:global(.sp-ni7hsi){display:block;}}@media (max-width: 767.9px){:global(.sp-i2kcv6){display:block;}}@media (max-width: 639.9px){:global(.sp-50t8dd){display:block;}}@media (min-width: 640px){:global(.sp-qllz92){display:block;}}@media (min-width: 768px){:global(.sp-nrzatl){display:block;}}@media (min-width: 1024px){:global(.sp-0dkduh){display:block;}}@media (min-width: 1280px){:global(.sp-hvht9m){display:block;}}</style>