<script lang="ts">
  import { onMount } from 'svelte'
  import { compressToEncodedURIComponent as encode } from '$lib/lz/lz-string'
  import { dev } from '$app/environment'

  interface Props {
    width: number;
    height: number;
    title: string;
    description: string;
    dictionaryName: string;
    lat: number;
    lng: number;
    gcsPath?: string;
  }

  let {
    width,
    height,
    title,
    description,
    dictionaryName,
    lat,
    lng,
    gcsPath = undefined
  }: Props = $props();

  let version = $state(new Date().getTime())
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
