<script>
  const { stickyHeading = false, stickyColumn = false, class: className = '', children } = $props()
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
    border-bottom-width:2px;border-color:color-mix(in srgb, var(--color) 12%, transparent);background-color:var(--surface);padding-left:0.75rem;padding-right:0.75rem;padding-top:0.75rem;padding-bottom:0.75rem;
  }
  :global(.responsive-table tr:hover td) {
    background-color:var(--surface);
  }
  :global(.responsive-table tr:focus-within td) {
    background-color:color-mix(in srgb, var(--background), var(--color) 12%);
  }
  :global(.responsive-table td) {
    border-bottom-width:1px;border-color:color-mix(in srgb, var(--color) 12%, transparent);padding-left:0.75rem;padding-right:0.75rem;padding-top:0.5rem;padding-bottom:0.5rem;font-size:0.875rem;line-height:1.25rem;
  }

  /* Sticky */
  :global(.stickyHeading thead th) {
    position:sticky;top:0;z-index:1;
  }
  :global(.stickyColumn thead th:first-child) {
    position:sticky;left:0;z-index:2;
  }
  :global(.stickyColumn td:first-child) {
    position:sticky;left:0;z-index:1;background-color:var(--background);
  }
</style>
