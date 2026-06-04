import { writable } from 'svelte/store';
export function createPersistedStore(key, initialValue, syncTabs = false) {
    if (typeof window === 'undefined') {
        const { subscribe, set, update } = writable(initialValue);
        return { subscribe, set, update };
    }
    const { subscribe, set, update } = writable(initialValue, start);
    function getCached() {
        const cachedValue = localStorage.getItem(key);
        if (cachedValue && cachedValue !== 'undefined')
            set(JSON.parse(cachedValue));
    }
    function start() {
        getCached();
        if (syncTabs) {
            window.addEventListener('storage', getCached);
            return () => {
                window.removeEventListener('storage', getCached);
            };
        }
    }
    const setStoreValue = (updatedValue) => {
        set(updatedValue);
        localStorage.setItem(key, JSON.stringify(updatedValue));
    };
    const updateStoreValue = (callback) => {
        update((currentValue) => {
            const updatedValue = callback(currentValue);
            localStorage.setItem(key, JSON.stringify(updatedValue));
            return updatedValue;
        });
    };
    return { subscribe, set: setStoreValue, update: updateStoreValue };
}
