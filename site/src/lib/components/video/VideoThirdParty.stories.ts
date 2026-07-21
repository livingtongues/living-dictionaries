import type { Story, StoryMeta } from 'svelte-look'
import type Component from './VideoThirdParty.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 520, height: 390 }],
  csr: true,
}

export const YouTubeMetadata: Story<typeof Component> = {
  viewports: [{ width: 520, height: 390 }],
  props: {
    hosted_video: { type: 'youtube', video_id: 'GrsknWZpr-k', start_at_seconds: 12 },
    hosted_metadata: { title: 'YouTube field recording', thumbnail_url: 'https://example.com/youtube.jpg' },
  },
}

export const VimeoMetadata: Story<typeof Component> = {
  viewports: [{ width: 520, height: 390 }],
  props: {
    hosted_video: { type: 'vimeo', video_id: '239862299', start_at_seconds: 18 },
    hosted_metadata: { title: 'Vimeo field recording', thumbnail_url: 'https://example.com/vimeo.jpg', duration_seconds: 64 },
  },
}

export const MetadataUnavailable: Story<typeof Component> = {
  viewports: [{ width: 520, height: 390 }],
  props: {
    hosted_video: { type: 'youtube', video_id: 'GrsknWZpr-k' },
  },
}
