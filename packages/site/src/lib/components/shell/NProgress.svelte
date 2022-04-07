<script lang="ts">
  import './nprogress.css';
  let NProgress;
  import { onMount } from 'svelte';
  onMount(async () => {
    NProgress = await import('nprogress');
    NProgress.configure({
      // https://github.com/rstacruz/nprogress#configuration
      minimum: 0.16,
      showSpinner: false,
    });
  });

  import { navigating } from '$app/stores';
  $: if (NProgress) {
    if ($navigating) {
      NProgress.start();
    }

    if (!$navigating) {
      NProgress.done();
    }
  }
</script>
