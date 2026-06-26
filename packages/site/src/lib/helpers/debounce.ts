// eslint-disable-next-line @typescript-eslint/ban-types
export function debounce(func: Function, delay = 1000) {
  let timer;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}
