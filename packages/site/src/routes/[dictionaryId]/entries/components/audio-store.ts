import { writable } from 'svelte/store'

export const audioStore = writable({
  current_audio: null,
  is_playing: false,
})

export function playAudio(url: string) {
  audioStore.update((store) => {
    if (store.current_audio) {
      store.current_audio.pause()
      store.current_audio = null
    }

    const audio = new Audio(url)
    audio.play()

    audio.addEventListener('ended', () => {
      audioStore.set({ current_audio: null, is_playing: false })
    })

    return { current_audio: audio, is_playing: true }
  })
}
