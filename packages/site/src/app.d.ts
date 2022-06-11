/// <reference types="@sveltejs/kit" />

// See https://kit.svelte.dev/docs/types#the-app-namespace
// for information about these interfaces
declare namespace App {
	interface Locals {
    user: import('@living-dictionaries/types').IUser;
    chosenLocale: string;
	}
  
	// interface Platform {}
  
  interface Session {
    user: import('@living-dictionaries/types').IUser;
    acceptedLanguage: string;
    chosenLocale: string;
  }
	// interface Stuff {}
}

declare namespace svelte.JSX {
  interface HTMLAttributes<T> {
    onclickOutside?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    onlongpress?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    onshortpress?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
  }
}

interface ImportMetaEnv {
  VITE_mapboxAccessToken: string;
  VITE_ProcessImageUrl: string;
  VITE_FIREBASE_CONFIG: string; // prod is added to Vercel env variables
}
