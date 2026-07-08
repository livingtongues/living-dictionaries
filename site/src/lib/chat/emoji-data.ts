/**
 * Emoji reactions palette. `QUICK_REACTIONS` are the always-visible one-tap
 * set; `EMOJI_CATEGORIES` back the "＋" popover (a curated ~90-emoji grid, no
 * search, no dependency — see chat read-receipts/reactions work).
 */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '✅'] as const

export interface EmojiCategory {
  label: string
  emojis: string[]
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    label: 'Smileys',
    emojis: ['😀', '😄', '😁', '😅', '😂', '🙂', '😉', '😊', '😍', '😘', '😜', '🤪', '🤩', '😎', '🤔', '🤨', '😐', '😴', '😢', '😭', '😤', '😡', '🥳', '🤯', '😱', '🤗', '🤫', '🙄'],
  },
  {
    label: 'Gestures',
    emojis: ['👍', '👎', '👌', '🤌', '✌️', '🤞', '🤟', '🤙', '👏', '🙌', '👐', '🙏', '💪', '👀', '👋', '🤝', '✍️', '🫡'],
  },
  {
    label: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💯'],
  },
  {
    label: 'Objects',
    emojis: ['🎉', '🎊', '🔥', '⭐', '🌟', '✨', '💡', '📌', '✅', '❌', '⚠️', '❓', '❗', '💬', '📣', '🚀', '🏆', '🎯', '🥇', '⏰'],
  },
  {
    label: 'Nature & food',
    emojis: ['🌱', '🌷', '🌈', '☀️', '🌙', '⚡', '❄️', '☕', '🍵', '🍎', '🍕', '🍰', '🎂', '🍺', '🥂'],
  },
]
