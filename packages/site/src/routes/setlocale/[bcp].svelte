<script context="module" lang="ts">
  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ page: { params } }) => {
    console.log({ params });
    return { props: { bcp: params.bcp } };
  };
</script>

<script lang="ts">
  import { locale } from 'svelte-i18n';
  import { setCookie } from '$lib/helpers/cookies';

  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  export let bcp: string;

  onMount(() => {
    if (bcp) {
      $locale = bcp;
      setCookie('locale', bcp, { 'max-age': 31536000 });
    }
    goto(`/`);
  });
</script>
