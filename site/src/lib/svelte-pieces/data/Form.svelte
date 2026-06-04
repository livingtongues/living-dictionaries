<script>
  let { onsubmit = undefined, children } = $props()
  let loading = $state(false)
  async function submitWithLoading(event) {
    if (onsubmit) {
      loading = true
      try {
        await onsubmit(event)
      } catch (err) {
        console.error(err)
        alert(err)
      }
      loading = false
    }
  }
</script>

<form onsubmit={(event) => { event.preventDefault(); submitWithLoading(event) }}>
  {@render children?.({ loading })}
</form>
