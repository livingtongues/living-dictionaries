<script lang="ts">
  import { locale } from 'svelte-i18n';
  import { setCookie } from '$lib/helpers/cookies';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  import type { PageData } from './$types';
  export let data: PageData;

  onMount(() => {
    if (data.bcp) {
      $locale = data.bcp;
      setCookie('locale', data.bcp, { 'max-age': 31536000 });
    }
    goto(`/`);
  });
</script>
