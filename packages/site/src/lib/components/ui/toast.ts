import { writable } from 'svelte/store'

type Theme = 'black' | 'red' | 'green'

interface ToastAction {
  label: string
  callback: () => void
}

export interface Toast {
  id: number
  message: string
  theme: Theme
  timeout_seconds?: number
  dismiss_label?: string
  action?: ToastAction
  progress?: number
}

interface ToastOptions {
  theme?: Theme
  dismiss_label?: string
  action?: ToastAction
  timeout_seconds?: number
}

function createToastsStore() {
  const { subscribe, update } = writable<Toast[]>([])
  return {
    subscribe,
    push: (toast_item: Toast) => update(toasts => [...toasts, toast_item]),
    remove: (id: number) => update(toasts => toasts.filter(t => t.id !== id)),
    update_toast: (id: number, message: string, progress: number) =>
      update(toasts =>
        toasts.map(t =>
          t.id === id ? { ...t, message, progress } : t,
        ),
      ),
  }
}
export const toasts = createToastsStore()

function base_toast(message: string, timeout_seconds_or_options?: number | ToastOptions) {
  let timeout_seconds = 4
  let final_options: ToastOptions = {}

  if (typeof timeout_seconds_or_options === 'number') {
    timeout_seconds = timeout_seconds_or_options
  } else if (timeout_seconds_or_options) {
    final_options = timeout_seconds_or_options
    if (final_options.timeout_seconds)
      ({ timeout_seconds } = final_options)
  }

  const id = Math.floor(Math.random() * 1_000_000_000)
  const toast_item: Toast = {
    id,
    message,
    theme: final_options.theme || 'black',
    timeout_seconds: final_options.dismiss_label ? undefined : timeout_seconds,
    dismiss_label: final_options.dismiss_label,
    action: final_options.action,
  }

  toasts.push(toast_item)

  if (!final_options.dismiss_label && timeout_seconds) {
    setTimeout(() => {
      toasts.remove(id)
    }, timeout_seconds * 1000)
  }
}

export const toast = Object.assign(base_toast, {
  error: (message: string, timeout_seconds_or_options?: number | Omit<ToastOptions, 'theme'>) => {
    if (typeof timeout_seconds_or_options === 'number') {
      base_toast(message, { timeout_seconds: timeout_seconds_or_options, theme: 'red' })
    } else {
      base_toast(message, { ...timeout_seconds_or_options, theme: 'red' })
    }
  },
  success: (message: string, timeout_seconds_or_options?: number | Omit<ToastOptions, 'theme'>) => {
    if (typeof timeout_seconds_or_options === 'number') {
      base_toast(message, { timeout_seconds: timeout_seconds_or_options, theme: 'green' })
    } else {
      base_toast(message, { ...timeout_seconds_or_options, theme: 'green' })
    }
  },
})
