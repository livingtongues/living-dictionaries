<script lang="ts">
  interface Props {
    label?: string
  }
  let { label = 'New' }: Props = $props()
</script>

<div class="unread-divider" role="separator" aria-label="New messages">
  <span class="line"></span>
  <span class="label">{label}</span>
</div>

<style>
  .unread-divider {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.35rem 0;
    color: var(--danger);
  }
  .line {
    flex: 1;
    height: 1px;
    background: currentColor;
    opacity: 0.55;
  }
  .label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    line-height: 1;
  }
</style>
