<script lang="ts">
  import { page } from '$app/state'
  import { compressToEncodedURIComponent as encode } from '$lib/lz/lz-string'
  import { seoTitle } from './seo-title'

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
    lng?: number
    lat?: number
  }

  let {
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
    lng = undefined,
    lat = undefined,
  }: Props = $props()

  let expandedDictionaryName = $derived(dictionaryName
    ? `${dictionaryName} ${page.data.t('misc.LD_singular')}`
    : null)
  let textTitle = $derived(seoTitle({ title: title || imageTitle, dictionaryName: expandedDictionaryName, admin }))
  let textDescription = $derived(description || imageDescription || 'Language Documentation Web App - Speeding the availability of language resources for endangered languages. Using technology to shift how we think about endangered languages. Rather than perceiving them as being antiquated, difficult to learn and on the brink of vanishing, we see them as modern and easily accessible for learning online in text and audio formats.')

  let imageProps = $derived({
    width,
    height,
    title: imageTitle,
    description: imageDescription,
    dictionaryName,
    lng,
    lat,
    gcsPath: gcsPath?.replace('\n', ''), // this slipped into the server response, can remove after database cleaned
  })
  let encodedImageProps = $derived(encode(JSON.stringify(imageProps)))
  let imageUrl = $derived(gcsPath ? `${IMAGE_API}?props=${encodedImageProps}&v=${OG_IMAGE_VERSION}` : DEFAULT_IMAGE)
  let imageWidth = $derived(dictionaryName ? width.toString() : '987')
  let imageHeight = $derived(dictionaryName ? width.toString() : '299')
</script>

<svelte:head>
  <title>{textTitle}</title>

  <meta name="description" content={textDescription} />
  <meta name="keywords" content={keywords} />

  {#if norobots}
    <meta name="robots" content="noindex" />
  {/if}

  <!-- https://ogp.me -->
  <meta property="og:title" content={textTitle} />
  <meta property="og:description" content={textDescription} />
  <meta property="og:site_name" content="Living Dictionaries" />
  <meta property="og:type" content={type} />
  <meta property="og:url" content={url} />
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
  <meta name="twitter:url" content={url} />
  <meta name="twitter:site" content="@{handle}" />
  <meta name="twitter:creator" content="@{handle}" />
</svelte:head>

<!--
  Once refactored to an initial language route url schema, update title to use proper one: {page.data.t('misc.LD')}
  Can offer alternate language urls when this is a feature: <link rel="alternate" hrefLang={languageAlternate.hrefLang} href={languageAlternate.href} />
 -->
