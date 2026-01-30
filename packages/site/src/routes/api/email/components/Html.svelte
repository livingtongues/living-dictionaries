<script lang="ts">
  interface Props {
    language?: string
    children?: import('svelte').Snippet
  }

  let { language = 'en', children }: Props = $props()

  // use spread to avoid type errors
  const xml_properties = {
    'xml:lang': language,
    'xmlns': 'http://www.w3.org/1999/xhtml',
    'xmlns:v': 'urn:schemas-microsoft-com:vml',
    'xmlns:o': 'urn:schemas-microsoft-com:office:office',
  }
</script>

<html lang={language} {...xml_properties}>
  {@render children?.()}
</html>
