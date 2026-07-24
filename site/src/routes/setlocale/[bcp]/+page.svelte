<script lang="ts">
  import { onMount } from 'svelte'
  import type { PageData } from './$types'
  import { set_locale_cookie } from '$lib/i18n/change-locale'
  import { get_supported_locale } from '$lib/i18n/locales'

  interface Props {
    data: PageData
  }

  const { data }: Props = $props()

  onMount(() => {
    const locale = get_supported_locale(data.bcp)
    if (locale)
      set_locale_cookie(locale)

    location.assign('/')
  })
</script>
