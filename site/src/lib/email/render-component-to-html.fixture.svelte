<script lang="ts">
  // Test-only fixture for render-component-to-html.test.ts. A minimal but REAL
  // email document assembled from the shared Shell/Title/Paragraph/
  // CallToActionButton components, so the renderer test exercises the same
  // full-document path (charset/viewport metas, email-safe table layout, SSR
  // comment stripping) without depending on any shippable email component.
  import CallToActionButton from '../../routes/api/email/components/CallToActionButton.svelte'
  import Paragraph from '../../routes/api/email/components/Paragraph.svelte'
  import Shell from '../../routes/api/email/components/Shell.svelte'
  import Title from '../../routes/api/email/components/Title.svelte'
</script>

<Shell dark={false} preview="Fixture preview text" title="Fixture Email">
  <Title text="Fixture Heading" row={{ top: 35 }} />
  <Paragraph row={{ top: 20 }}>Fixture body paragraph for the renderer test.</Paragraph>
  <CallToActionButton href="https://livingdictionaries.app" backgroundColor="#1e40af" row={{ space: 30 }}>Fixture Button</CallToActionButton>
</Shell>
