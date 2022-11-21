<script lang="ts">
  import { page } from '$app/stores';
  import { compressToEncodedURIComponent as encode } from 'lz-string';

  const SITE_NAME = 'Living Dictionaries';
  export let title = SITE_NAME;
  $: titleWithSuffix = title === SITE_NAME ? title : title + ' | ' + SITE_NAME;

  export let description =
    'Language Documentation Web App - Speeding the availability of language resources for endangered languages. Using technology to shift how we think about endangered languages. Rather than perceiving them as being antiquated, difficult to learn and on the brink of vanishing, we see them as modern and easily accessible for learning online in text and audio formats.';
  export let keywords =
    'Minority Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis';
  export let type: 'video' | 'website' = 'website'; // https://ogp.me/#types
  export let norobots = false;
  export let handle = 'livingtongues';

  const IMAGE_API = 'https://ld-parts.vercel.app/og';
  export let width = 1200;
  export let height = 600;
  export let dictionaryName: string = undefined;
  export let gcsPath: string = undefined;
  export let lng: number = undefined;
  export let lat: number = undefined;
  const props = encode(
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
  $: imageUrl = `${IMAGE_API}?props=${props}&v=2`;
</script>

<svelte:head>
  <title>{titleWithSuffix}</title>

  <meta name="description" content={description} />
  <meta name="keywords" content={keywords} />

  {#if norobots}
    <meta name="robots" content="noindex" />
  {/if}

  <!-- https://ogp.me -->
  <meta property="og:title" content={titleWithSuffix} />
  <meta property="og:description" content={description} />
  <meta property="og:site_name" content="Living Dictionaries" />
  <meta property="og:type" content={type} />
  <meta property="og:url" content={$page.url.toString()} />
  <meta property="og:locale" content="en" />

  <meta property="og:image" content={imageUrl} />
  <meta property="og:image:secure_url" content={imageUrl} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content={width.toString()} />
  <meta property="og:image:height" content={height.toString()} />
  <meta property="og:image:alt" content={`${title}: ${description}`} />

  <!-- https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/summary-card-with-large-image -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={titleWithSuffix} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={imageUrl} />
  <meta name="twitter:image:alt" content={`${title}: ${description}`} />
  <meta name="twitter:url" content={$page.url.toString()} />
  <meta name="twitter:site" content="@{handle}" />
  <meta name="twitter:creator" content="@{handle}" />
</svelte:head>

<!-- 
  Can offer alternate language urls when this is a feature: <link rel="alternate" hrefLang={languageAlternate.hrefLang} href={languageAlternate.href} />
 -->
