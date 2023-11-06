// See https://kit.svelte.dev/docs/types#app
declare namespace App {
  // interface Locals {}
  interface PageData {
    locale: import('$lib/i18n/locales').LocaleCode;
    t: import('$lib/i18n/types.ts').TranslateFunction;
    // user: import('@living-dictionaries/types').IUser;
  }
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
