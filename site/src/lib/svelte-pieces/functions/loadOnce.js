function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
export const loadScriptOnce = (() => {
    const loaded = [];
    return async function (url) {
        if (!loaded.includes(url)) {
            await loadScript(url);
            loaded.push(url);
            return true;
        }
        return true;
    };
})();
function loadStyles(url) {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = resolve;
        link.onerror = reject;
        document.head.appendChild(link);
    });
}
export const loadStylesOnce = (() => {
    const loaded = [];
    return async function (url) {
        if (!loaded.includes(url)) {
            await loadStyles(url);
            loaded.push(url);
            return true;
        }
        return true;
    };
})();
