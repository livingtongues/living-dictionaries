<script lang="ts">
  import { page } from '$app/state'
  import AboutContent from './AboutContent.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
</script>

<Header>
  {page.data.t('about.about_LD')}
</Header>

<AboutContent />

<SeoMetaTags
  title={page.data.t('about.about_LD')}
  description="Living Dictionaries are mobile-friendly web tools that support endangered, under-represented and diasporic languages. Led by community activists around the globe, Living Dictionaries are collaborative multimedia projects that help languages survive for generations to come."
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Tongues Institute for Endangered Languages, Gregory D. S. Anderson" />

<!-- Used to have TOU link here -->
