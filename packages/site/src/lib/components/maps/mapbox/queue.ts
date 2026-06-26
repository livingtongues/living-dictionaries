import { writable } from 'svelte/store';

export class EventQueue {
  queue;
  unsubscribe;
  started;

  constructor() {
    this.queue = writable([]);
    this.unsubscribe = null;
    this.started = false;
  }

  send(command, params = []) {
    if (!command)
      return;

    this.queue.update((q) => [...q, [command, params]]);
  }

  start(map) {
    this.unsubscribe = this.queue.subscribe((queue) => {
      while (queue.length) {
        const [command, params] = queue.shift();

        map[command].apply(map, params);
        // map[command](...params);
      }
    });
    this.started = true;
  }

  stop() {
    if (!this.started)
      return;

    this.unsubscribe();
    this.queue = writable([]);
    this.started = false;
  }
}
