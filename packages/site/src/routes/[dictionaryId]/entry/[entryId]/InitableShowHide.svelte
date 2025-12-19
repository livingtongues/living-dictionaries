<script lang="ts">
  interface Props {
    show?: string | boolean;
    children?: import('svelte').Snippet<[any]>;
  }

  let { show = $bindable(false), children }: Props = $props();
  function toggle() {
    show = !show;
  }
  function set(value: string | boolean) {
    show = value;
  }
</script>

{@render children?.({ show, toggle, set, })}

