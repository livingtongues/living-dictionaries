<script>
  import Slideover from './Slideover.svelte'

  let {
    zIndex = 60,
    duration = 200,
    side = 'right',
    widthRem = 16,
    maxWidthPercentage = 70,
    showWidth = undefined,
    desktopClasses = '',
    mobileClasses = '',
    open = false,
    on_close = undefined,
    children,
  } = $props()
</script>

<div
  class="desktop {desktopClasses}"
  class:sm={showWidth === 'sm'}
  class:md={showWidth === 'md'}
  class:lg={showWidth === 'lg'}
  class:xl={showWidth === 'xl'}>
  {@render children?.()}
</div>

{#if open}
  <div
    class="mobile {mobileClasses}"
    class:sm={showWidth === 'sm'}
    class:md={showWidth === 'md'}
    class:lg={showWidth === 'lg'}
    class:xl={showWidth === 'xl'}>
    <Slideover
      {duration}
      {zIndex}
      {side}
      {widthRem}
      {maxWidthPercentage}
      {on_close}>
      {@render children?.()}
    </Slideover>
  </div>
{/if}

<style>
  .desktop,
  .mobile {
    display: none;
  }

  @media (min-width: 640px) {
    .desktop.sm {
      display: block;
    }
  }

  @media (min-width: 768px) {
    .desktop.md {
      display: block;
    }
  }

  @media (min-width: 1024px) {
    .desktop.lg {
      display: block;
    }
  }

  @media (min-width: 1280px) {
    .desktop.xl {
      display: block;
    }
  }

  @media (max-width: 639.9px) {
    .mobile.sm {
      display: block;
    }
  }

  @media (max-width: 767.9px) {
    .mobile.md {
      display: block;
    }
  }

  @media (max-width: 1023.9px) {
    .mobile.lg {
      display: block;
    }
  }

  @media (max-width: 1279.9px) {
    .mobile.xl {
      display: block;
    }
  }
</style>
