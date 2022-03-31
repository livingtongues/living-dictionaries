<script context="module" lang="ts">
  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ page: { params } }) => {
    return { status: 308, redirect: `/${params.dictionaryId}/entry/${params.redirectId}` };
  };
</script>
