<script>
  let { stickyHeading = false, stickyColumn = false, class: className = '', children } = $props()
</script>

<div class:stickyHeading class:stickyColumn class="responsive-wrapper {className}">
  <table class="responsive-table">
    {@render children?.()}
  </table>
</div>

<style>
  .responsive-wrapper {
    width:100%;height:100%;overflow:auto;border-width:1px;border-radius:0.25rem;
  }
  .responsive-table {
    min-width: 100%;
  }
  :global(.responsive-table thead th) {
    text-align: start;
    /* text-align: start to accomodate RTL languages */
    border-bottom-width:2px;--un-border-opacity:1;border-color:rgb(229 231 235 / var(--un-border-opacity));--un-bg-opacity:1;background-color:rgb(243 244 246 / var(--un-bg-opacity));padding-left:0.75rem;padding-right:0.75rem;padding-top:0.75rem;padding-bottom:0.75rem;
  }
  :global(.responsive-table tr:hover td) {
    --un-bg-opacity:1;background-color:rgb(243 244 246 / var(--un-bg-opacity));
  }
  :global(.responsive-table tr:focus-within td) {
    --un-bg-opacity:1;background-color:rgb(229 231 235 / var(--un-bg-opacity));
  }
  :global(.responsive-table td) {
    border-bottom-width:1px;--un-border-opacity:1;border-color:rgb(229 231 235 / var(--un-border-opacity));padding-left:0.75rem;padding-right:0.75rem;padding-top:0.5rem;padding-bottom:0.5rem;font-size:0.875rem;line-height:1.25rem;
  }

  /* Sticky */
  :global(.stickyHeading thead th) {
    position:sticky;top:0;z-index:1;
  }
  :global(.stickyColumn thead th:first-child) {
    position:sticky;left:0;z-index:2;
  }
  :global(.stickyColumn td:first-child) {
    position:sticky;left:0;z-index:1;--un-bg-opacity:1;background-color:rgb(255 255 255 / var(--un-bg-opacity));
  }
</style>
