<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import { setLocaleCookie } from '$lib/i18n/changeLocale';
  import { getSupportedLocale } from '$lib/i18n/locales';

  export let data: PageData;

  onMount(() => {
    const locale = getSupportedLocale(data.bcp);
    if (locale)
      setLocaleCookie(locale);

    location.assign('/');
  });
</script>
