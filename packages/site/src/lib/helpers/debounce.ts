export function debounce(func: (...args: any[]) => any, delay = 1000) {
  let timer
  return (...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      func(...args)
    }, delay)
  }
}
