<script lang="ts">
  import type { PageData } from './$types'
  import { setLocaleCookie } from '$lib/i18n/changeLocale'
  import { getSupportedLocale } from '$lib/i18n/locales'
  import { onMount } from 'svelte'

  interface Props {
    data: PageData
  }

  let { data }: Props = $props()

  onMount(() => {
    const locale = getSupportedLocale(data.bcp)
    if (locale)
      setLocaleCookie(locale)

    location.assign('/')
  })
</script>
