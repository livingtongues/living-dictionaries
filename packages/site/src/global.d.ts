/// <reference types="@sveltejs/kit" />

declare namespace svelte.JSX {
  interface HTMLAttributes<T> {
    onclickOutside?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    onlongpress?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    onshortpress?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
  }
}

interface ImportMetaEnv {
  VITE_project: 'talking-dictionaries-dev' | 'talking-dictionaries-alpha'; // 'development' | 'production';
  VITE_mapboxAccessToken: string;
  VITE_ProcessImageUrl: string;
  VITE_FIREBASE_CONFIG: string; // prod is added to Vercel env variables
}
