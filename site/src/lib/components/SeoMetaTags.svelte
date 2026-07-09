<script lang="ts">
  import { seoTitle } from './seo-title'
  import { compressToEncodedURIComponent as encode } from '$lib/lz/lz-string'
  import { page } from '$app/state'

  const IMAGE_API = '/og'
  const DEFAULT_IMAGE
    = 'https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/livingdictionary%2Fimages%2FNEW_Living_Tongues_logo_with_white_around_it.png?alt=media' // 1484 x 729
  const OG_IMAGE_VERSION = 4

  interface Props {
    admin?: boolean
    dictionaryName?: string
    title?: string
    imageTitle?: string
    description?: string
    imageDescription?: string
    keywords?: string
    type?: 'video' | 'website' // https://ogp.me/#types
    norobots?: boolean
    handle?: string
    url?: any
    width?: number
    height?: number
    gcsPath?: string
    /** Force the generated `/og` card even without a photo (e.g. entries, which
     * render a globe + lexeme + gloss card). Without a photo and without this,
     * the og:image falls back to the generic Living Tongues logo. */
    generate_og_image?: boolean
    lng?: number
    lat?: number
  }

  const {
    admin = false,
    dictionaryName = undefined,
    title = undefined,
    imageTitle = undefined,
    description = undefined,
    imageDescription = undefined,
    keywords = 'Minority Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis',
    type = 'website',
    norobots = false,
    handle = 'livingtongues',
    url = page.url.toString(),
    width = 1200,
    height = 600,
    gcsPath = undefined,
    generate_og_image = false,
    lng = undefined,
    lat = undefined,
  }: Props = $props()

  const expandedDictionaryName = $derived(dictionaryName
    ? `${dictionaryName} ${page.data.t('misc.LD_singular')}`
    : null)
  const textTitle = $derived(seoTitle({ title: title || imageTitle, dictionaryName: expandedDictionaryName, admin }))
  const textDescription = $derived(description || imageDescription || 'Language Documentation Web App - Speeding the availability of language resources for endangered languages. Using technology to shift how we think about endangered languages. Rather than perceiving them as being antiquated, difficult to learn and on the brink of vanishing, we see them as modern and easily accessible for learning online in text and audio formats.')

  const imageProps = $derived({
    width,
    height,
    title: imageTitle,
    description: imageDescription,
    dictionaryName,
    lng,
    lat,
    gcsPath: gcsPath?.replace('\n', ''), // this slipped into the server response, can remove after database cleaned
  })
  const encodedImageProps = $derived(encode(JSON.stringify(imageProps)))
  // og:image must be an absolute URL (https://ogp.me) — many scrapers drop relative ones.
  const imageUrl = $derived(gcsPath || generate_og_image ? `${page.url.origin}${IMAGE_API}?props=${encodedImageProps}&v=${OG_IMAGE_VERSION}` : DEFAULT_IMAGE)
  const imageWidth = $derived(dictionaryName ? width.toString() : '987')
  const imageHeight = $derived(dictionaryName ? width.toString() : '299')

  // Canonical: the explicit `url` prop when a page passes one (e.g. entries), else the
  // current path with the query string stripped — collapses filter/pagination states
  // into one indexable URL. Omitted on noindex pages. The [dictionaryId] layout already
  // redirects legacy ids to the canonical slug, so pathname is canonical by then.
  const canonicalUrl = $derived(url !== page.url.toString() ? url : `${page.url.origin}${page.url.pathname}`)
</script>

<svelte:head>
  <title>{textTitle}</title>

  <meta name="description" content={textDescription} />
  <meta name="keywords" content={keywords} />

  {#if norobots}
    <meta name="robots" content="noindex" />
  {:else}
    <link rel="canonical" href={canonicalUrl} />
  {/if}

  <!-- https://ogp.me -->
  <meta property="og:title" content={textTitle} />
  <meta property="og:description" content={textDescription} />
  <meta property="og:site_name" content="Living Dictionaries" />
  <meta property="og:type" content={type} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:locale" content="en" />

  <meta property="og:image" content={imageUrl} />
  <meta property="og:image:secure_url" content={imageUrl} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content={imageWidth} />
  <meta property="og:image:height" content={imageHeight} />
  <meta property="og:image:alt" content={`${imageTitle}: ${imageDescription}`} />

  <!-- https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/summary-card-with-large-image -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={textTitle} />
  <meta name="twitter:description" content={textDescription} />
  <meta name="twitter:image" content={imageUrl} />
  <meta name="twitter:image:alt" content={`${imageTitle}: ${imageDescription}`} />
  <meta name="twitter:url" content={canonicalUrl} />
  <meta name="twitter:site" content="@{handle}" />
  <meta name="twitter:creator" content="@{handle}" />
</svelte:head>

<!--
  Once refactored to an initial language route url schema, update title to use proper one: {page.data.t('misc.LD')}
  Can offer alternate language urls when this is a feature: <link rel="alternate" hrefLang={languageAlternate.hrefLang} href={languageAlternate.href} />
 -->
