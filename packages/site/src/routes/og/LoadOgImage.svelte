<script lang="ts">
  import { onMount } from 'svelte'
  import { compressToEncodedURIComponent as encode } from 'kitbook'
  import { dev } from '$app/environment'

  export let width: number
  export let height: number
  export let title: string
  export let description: string
  export let dictionaryName: string
  export let lat: number
  export let lng: number
  export let gcsPath: string = undefined

  let version = new Date().getTime()
  onMount(() => {
    if (dev) {
      const interval = setInterval(
        () => (version = new Date().getTime()),
        5000,
      )
      return () => {
        clearInterval(interval)
      }
    }
  })
</script>

<img
  style="max-width: 100%;"
  src="/og?props={encode(
    JSON.stringify({
      width,
      height,
      title,
      description,
      dictionaryName,
      lng,
      lat,
      gcsPath,
    }),
  )}&v={version}" />
