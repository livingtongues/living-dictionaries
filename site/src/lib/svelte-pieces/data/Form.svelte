<script> export let onsubmit
let loading = false
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

<form on:submit|preventDefault={submitWithLoading}>
  <slot {loading} />
</form>
