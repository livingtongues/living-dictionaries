<script lang="ts">
  import { page } from '$app/state'
  import Footer from '$lib/components/shell/Footer.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import LegalPage from '$lib/components/LegalPage.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import privacy_md from '$lib/legal/privacy-policy.md?raw'
</script>

<Header>
  {page.data.t('terms.privacy_policy')}
</Header>

<LegalPage md={privacy_md} />

<Footer />

<SeoMetaTags
  title={page.data.t('terms.privacy_policy')}
  description="Privacy Policy proposal for the Living Dictionaries platform, including account data, dictionary content, media, local storage, diagnostics, analytics, and service providers."
  keywords="Privacy Policy, Living Dictionaries, language documentation, account data, media, local storage" />
