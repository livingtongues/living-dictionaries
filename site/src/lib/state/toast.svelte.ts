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

function create_toasts_store() {
  let items = $state<Toast[]>([])
  return {
    get items() { return items },
    push: (toast_item: Toast) => { items = [...items, toast_item] },
    remove: (id: number) => { items = items.filter(toast_item => toast_item.id !== id) },
    update_toast: (id: number, message: string, progress: number) => {
      items = items.map(toast_item =>
        toast_item.id === id ? { ...toast_item, message, progress } : toast_item,
      )
    },
  }
}
export const toasts = create_toasts_store()

function base_toast(message: string, timeout_seconds_or_options?: number | ToastOptions) {
  let timeout_seconds = 4
  let final_options: ToastOptions = {}

  if (typeof timeout_seconds_or_options === 'number') {
    timeout_seconds = timeout_seconds_or_options
  } else if (timeout_seconds_or_options) {
    final_options = timeout_seconds_or_options
    const { timeout_seconds: opts_timeout } = final_options
    if (opts_timeout)
      timeout_seconds = opts_timeout
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
      base_toast(message, timeout_seconds_or_options)
    } else {
      base_toast(message, { ...timeout_seconds_or_options, theme: 'red' })
    }
  },
  success: (message: string, timeout_seconds_or_options?: number | Omit<ToastOptions, 'theme'>) => {
    if (typeof timeout_seconds_or_options === 'number') {
      base_toast(message, timeout_seconds_or_options)
    } else {
      base_toast(message, { ...timeout_seconds_or_options, theme: 'green' })
    }
  },
})

export function create_progress_toast(message: string, theme: Theme = 'black', action?: ToastAction) {
  const id = Math.floor(Math.random() * 1_000_000_000)
  toasts.push({
    id,
    message,
    theme,
    progress: 0,
    action,
  })
  return {
    update: (message: string, progress: number) =>
      toasts.update_toast(id, message, progress),
    remove: () => toasts.remove(id),
  }
}
