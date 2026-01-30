<script lang="ts">
  interface Props {
    onsubmit: (
      e: SubmitEvent & {
        currentTarget: EventTarget & HTMLFormElement
      }
    ) => any
    children?: import('svelte').Snippet<[{ loading: boolean }]>
  }

  const { onsubmit, children }: Props = $props()
  let loading = $state(false)

  async function submitWithLoading(event: SubmitEvent) {
    if (onsubmit) {
      loading = true
      try {
        await onsubmit(event as SubmitEvent & { currentTarget: EventTarget & HTMLFormElement })
      } catch (err) {
        console.error(err)
        alert(err)
      }
      loading = false
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); submitWithLoading(e) }}>
  {@render children?.({ loading })}
</form>
