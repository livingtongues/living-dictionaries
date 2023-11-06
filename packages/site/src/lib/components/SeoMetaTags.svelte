<script lang="ts">
  import { page } from '$app/stores';
  import LZString from 'lz-string';
  import { seoTitle } from './seo-title';
  const { compressToEncodedURIComponent: encode } = LZString;

  const IMAGE_API = 'https://ld-parts.vercel.app/og';
  const DEFAULT_IMAGE =
    'https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/livingdictionary%2Fimages%2FNEW_Living_Tongues_logo_with_white_around_it.png?alt=media'; // 1484 x 729
  const OG_IMAGE_VERSION = 4;

  export let admin = false;
  export let dictionaryName: string = undefined;
  export let title: string = undefined;
  export let imageTitle: string = undefined;
  export let description: string = undefined;
  export let imageDescription: string = undefined;
  export let keywords =
    'Minority Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis';
  export let type: 'video' | 'website' = 'website'; // https://ogp.me/#types
  export let norobots = false;
  export let handle = 'livingtongues';
  export let url = $page.url.toString();

  export let width = 1200;
  export let height = 600;
  export let gcsPath: string = undefined;
  export let lng: number = undefined;
  export let lat: number = undefined;

  $: expandedDictionaryName = dictionaryName
    ? `${dictionaryName} ${$page.data.t('misc.LD_singular')}`
    : null;
  $: textTitle = seoTitle({ title: title || imageTitle, dictionaryName: expandedDictionaryName, admin });
  $: textDescription = description || imageDescription || 'Language Documentation Web App - Speeding the availability of language resources for endangered languages. Using technology to shift how we think about endangered languages. Rather than perceiving them as being antiquated, difficult to learn and on the brink of vanishing, we see them as modern and easily accessible for learning online in text and audio formats.'

  $: imageProps = {
    width,
    height,
    title: imageTitle,
    description: imageDescription,
    dictionaryName,
    lng,
    lat,
    gcsPath: gcsPath?.replace('\n', ''), // this slipped into the server response, can remove after database cleaned
  };
  $: encodedImageProps = encode(JSON.stringify(imageProps));
  $: imageUrl = gcsPath ? `${IMAGE_API}?props=${encodedImageProps}&v=${OG_IMAGE_VERSION}` : DEFAULT_IMAGE;
  $: imageWidth = dictionaryName ? width.toString() : '987';
  $: imageHeight = dictionaryName ? width.toString() : '299';
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
  Once refactored to an initial language route url schema, update title to use proper one: {$page.data.t('misc.LD')}
  Can offer alternate language urls when this is a feature: <link rel="alternate" hrefLang={languageAlternate.hrefLang} href={languageAlternate.href} />
 -->
