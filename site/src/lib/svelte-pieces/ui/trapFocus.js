export function trapFocus(e, container) {
    const nodes = container.querySelectorAll('*');
    const tabbable = Array.from(nodes).filter((n) => n.tabIndex >= 0);
    let index = tabbable.indexOf(document.activeElement);
    if (index === -1 && e.shiftKey)
        index = 0;
    index += tabbable.length + (e.shiftKey ? -1 : 1);
    index %= tabbable.length;
    tabbable[index].focus();
    e.preventDefault();
}
