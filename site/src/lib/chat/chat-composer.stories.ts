import type { Story, StoryMeta } from 'svelte-look'
import type Component from '$lib/chat/chat-composer.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 560, height: 220 }],
}

const noop = (() => {}) as never

export const Default: Story<typeof Component> = {
  props: { on_send: noop, placeholder: 'Write your message…' },
}

export const Sending: Story<typeof Component> = {
  props: { on_send: noop, sending: true, placeholder: 'Write your message…' },
}

export const Replying: Story<typeof Component> = {
  props: { on_send: noop, on_cancel_reply: noop, placeholder: 'Write your message…', reply_target: { author_name: 'Greg', snippet: 'Can you double-check the phonetics on entry #42 before we publish it tonight?' } },
}
