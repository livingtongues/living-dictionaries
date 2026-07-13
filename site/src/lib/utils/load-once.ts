function loadScript(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export const load_script_once = (() => {
  const loaded: string[] = []
  return async function (url: string) {
    if (!loaded.includes(url)) {
      await loadScript(url)
      loaded.push(url)
      return true
    }
    return true
  }
})()

function loadStyles(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.onload = resolve
    link.onerror = reject
    document.head.appendChild(link)
  })
}

export const load_styles_once = (() => {
  const loaded: string[] = []
  return async function (url: string) {
    if (!loaded.includes(url)) {
      await loadStyles(url)
      loaded.push(url)
      return true
    }
    return true
  }
})()
