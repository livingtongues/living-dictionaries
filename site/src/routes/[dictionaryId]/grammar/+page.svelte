<script lang="ts">
  import { page } from '$app/state'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import GrammarSectionsView from './GrammarSectionsView.svelte'
  import GlossingLegend from '$lib/corpus/GlossingLegend.svelte'
  import { grammar_sections_editable } from '$lib/corpus/grammar-preview'

  const { data } = $props()
  const { is_manager, dictionary } = $derived(data)

  // Since the 2026-07-15 cutover the section tree renders for everyone; since
  // 2026-07-27 STRUCTURAL editing is open to the dictionary's own managers (site
  // admins still bypass). `prose_editable` is now redundant for managers but stays
  // for the admin-3-only case. The legacy `dictionaries.grammar` blob has been
  // migrated into sections + the column dropped (cutover stage 2).
  const sections_editable = $derived(grammar_sections_editable({ auth_user: page.data.auth_user, is_manager }))
</script>

<div class="grammar">
  <h3 class="grammar-heading">
    {page.data.t('dictionary.grammar')}
  </h3>

  <div class="sections-block">
    <GrammarSectionsView editable={sections_editable} prose_editable={is_manager} />
    <GlossingLegend />
  </div>
</div>

<SeoMetaTags
  norobots={!dictionary.public}
  title={page.data.t('dictionary.grammar')}
  dictionaryName={dictionary.name}
  description="Learn about the grammar of the language in this Living Dictionary."
  keywords="Grammar of a language, grammatical, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Bibliography" />

<style>
  :global(.grammar img) {
    max-width: 100%;
  }

  :global(.grammar figure) {
    margin: 0;
  }

  .grammar-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .sections-block {
    max-width: 768px;
  }
</style>
