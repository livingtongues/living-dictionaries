<script lang="ts">
  import IconMdiClose from '~icons/mdi/close'

  interface Props {
    src: string
    alt?: string
    on_remove: () => void
  }

  let { src, alt = 'Attachment preview', on_remove }: Props = $props()
</script>

<div class="staged-image-thumb">
  <img {src} {alt} />
  <button type="button" class="staged-image-remove" aria-label="Remove attachment" onclick={on_remove}>
    <IconMdiClose />
  </button>
</div>

<style>
  .staged-image-thumb {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
  }
  .staged-image-thumb img {
    display: block;
    width: 4rem;
    height: 4rem;
    object-fit: cover;
    border-radius: 0.375rem;
    border: 1px solid var(--border-color);
  }
  .staged-image-remove {
    position: absolute;
    top: -0.375rem;
    right: -0.375rem;
    width: 1.25rem;
    height: 1.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color) 85%, black);
    color: #fff;
    cursor: pointer;
    padding: 0;
    font-size: 0.75rem;
  }
  .staged-image-remove:hover {
    background: var(--danger);
  }
</style>
