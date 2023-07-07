<script lang="ts">
  import { t } from 'svelte-i18n';
  import { page } from '$app/stores';
  import LZString from 'lz-string';
  import { seoTitle } from './seo-title';
  const { compressToEncodedURIComponent: encode } = LZString;

  export let admin = false;
  export let title: string;
  export let dictionaryName: string = undefined;
  
  $: expandedDictionaryName = dictionaryName
    ? `${dictionaryName} ${$t('misc.LD_singular', { default: 'Living Dictionary' })}`
    : null;
  $: textTitle = seoTitle({ title, dictionaryName: expandedDictionaryName, admin });

  export let description =
    'Language Documentation Web App - Speeding the availability of language resources for endangered languages. Using technology to shift how we think about endangered languages. Rather than perceiving them as being antiquated, difficult to learn and on the brink of vanishing, we see them as modern and easily accessible for learning online in text and audio formats.';
  export let keywords =
    'Minority Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis';
  export let type: 'video' | 'website' = 'website'; // https://ogp.me/#types
  export let norobots = false;
  export let handle = 'livingtongues';
  export let url = $page.url.toString();

  const DEFAULT_IMAGE =
    'https://i2.wp.com/livingtongues.org/wp-content/uploads/2015/03/LT-logo-1.png?w=987&ssl=1'; // 987 x 299

  const IMAGE_API = 'https://ld-parts.vercel.app/og';
  export let width = 1200;
  export let height = 600;
  export let gcsPath: string = undefined;
  export let featuredImage: string = undefined;
  export let lng: number = undefined;
  export let lat: number = undefined;
  $: props = featuredImage ?
    encode(
      JSON.stringify({
        width,
        height,
        title,
        dictionaryName,
        lng,
        lat,
        featuredImage,
    })) : encode(
    JSON.stringify({
      width,
      height,
      title,
      description,
      dictionaryName,
      lng,
      lat,
      gcsPath,
    })
  );
  $: imageUrl = gcsPath || featuredImage ? `${IMAGE_API}?props=${props}&v=3` : DEFAULT_IMAGE;
  $: imageWidth = dictionaryName ? width.toString() : '987';
  $: imageHeight = dictionaryName ? width.toString() : '299';
</script>

<svelte:head>
  <title>{textTitle}</title>

  <meta name="description" content={description} />
  <meta name="keywords" content={keywords} />

  {#if norobots}
    <meta name="robots" content="noindex" />
  {/if}

  <!-- https://ogp.me -->
  <meta property="og:title" content={textTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:site_name" content="Living Dictionaries" />
  <meta property="og:type" content={type} />
  <meta property="og:url" content={url} />
  <meta property="og:locale" content="en" />

  <meta property="og:image" content={imageUrl} />
  <meta property="og:image:secure_url" content={imageUrl} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content={imageWidth} />
  <meta property="og:image:height" content={imageHeight} />
  <meta property="og:image:alt" content={`${title}: ${description}`} />

  <!-- https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/summary-card-with-large-image -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={textTitle} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={imageUrl} />
  <meta name="twitter:image:alt" content={`${title}: ${description}`} />
  <meta name="twitter:url" content={url} />
  <meta name="twitter:site" content="@{handle}" />
  <meta name="twitter:creator" content="@{handle}" />
</svelte:head>

<!-- 
  Once refactored to an initial language route url schema, update title to use proper one: {$_('misc.LD', { default: 'Living Dictionaries' })}
  Can offer alternate language urls when this is a feature: <link rel="alternate" hrefLang={languageAlternate.hrefLang} href={languageAlternate.href} />
 -->
