export function load(assets, cb) {
  for (const { type, value, id } of assets) {
    const existing = document.getElementById(id);

    if (existing) {
      if (type === 'script') {
        cb();
      }
      return;
    }

    const tag = document.createElement(type);
    tag.id = id;
    if (type === 'script') {
      tag.async = true;
      tag.defer = true;
      tag.src = value;
      tag.onload = () => cb();
    } else {
      tag.rel = 'stylesheet';
      tag.href = value;
    }
    document.body.appendChild(tag);
  }
}

const loadScript = (url: string) =>
  new Promise<Event>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

export const loadScriptOnce = (() => {
  const loaded = [];
  return async function (url) {
    if (!loaded.includes(url)) {
      await loadScript(url);
      loaded.push(url);
      return true;
    } else {
      return true;
    }
  };
})();

const loadStyles = (url: string) =>
  new Promise<Event>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);
  });

export const loadStylesOnce = (() => {
  let loaded = [];
  return async function (url) {
    if (!loaded.includes(url)) {
      await loadStyles(url);
      loaded = [url];
      return true;
    } else {
      return true;
    }
  };
})();
