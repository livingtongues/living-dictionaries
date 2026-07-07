<script lang="ts">
  import { page } from '$app/state'
  import Header from '$lib/components/shell/Header.svelte'
  import LegalPage from '$lib/components/LegalPage.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import terms_md from '$lib/legal/terms-of-use.md?raw'
</script>

<Header>
  {page.data.t('dictionary.terms_of_use')}
</Header>

<LegalPage md={terms_md} />

<SeoMetaTags
  title={page.data.t('dictionary.terms_of_use')}
  description="Terms of Use for the Living Dictionaries platform, including contribution permissions, community takedown, DMCA, dispute resolution, and acceptable use."
  keywords="Terms of Use, Living Dictionaries, contribution license, community permission, DMCA" />
