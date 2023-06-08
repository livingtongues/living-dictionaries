// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
// and what to do when importing types
declare namespace App {
	// interface Locals {}

	// interface PageData {}
  // user: import('@living-dictionaries/types').IUser;

	// interface Error {}

	// interface Platform {}
}

declare namespace svelte.JSX {
  interface HTMLAttributes<T> {
    onclickoutside?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    onlongpress?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    onshortpress?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
  }
}
