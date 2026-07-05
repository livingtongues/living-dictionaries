<script lang="ts">
  // Shimmer placeholder box. Compose these to mirror a page's final layout so
  // streamed data fills in without a layout shift. Used by admin *Skeleton.svelte
  // loading states (see admin routes' {#await} branches).
  interface Props {
    width?: string
    height?: string
    radius?: string
    class?: string
  }
  let { width = '100%', height = '1rem', radius = '0.375rem', class: klass = '' }: Props = $props()
</script>

<div class={['skeleton', klass]} style="width:{width};height:{height};border-radius:{radius}"></div>

<style>
  .skeleton {
    display: block;
    flex-shrink: 0;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-secondary, #888) 13%, transparent) 25%,
      color-mix(in srgb, var(--color-secondary, #888) 24%, transparent) 37%,
      color-mix(in srgb, var(--color-secondary, #888) 13%, transparent) 63%
    );
    background-size: 400% 100%;
    animation: skeleton-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes skeleton-shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: 0 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .skeleton { animation: none; }
  }
</style>
