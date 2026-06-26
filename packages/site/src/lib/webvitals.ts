// From https://ivoberger.com/posts/using-vercel-analytics-with-svelte-kit/ which was from https://github.com/vercel/gatsby-plugin-vercel/blob/main/src/web-vitals.js

import type { Metric, getCLS, getFCP, getFID, getLCP, getTTFB } from 'web-vitals';

declare const webVitals: {
  getFID: typeof getFID;
  getTTFB: typeof getTTFB;
  getLCP: typeof getLCP;
  getCLS: typeof getCLS;
  getFCP: typeof getFCP;
};

let isRegistered = false;

interface AnalyticsOptions {
  params: Record<string, any> | ArrayLike<any>;
  path: string;
  analyticsId: string;
  debug?: true;
}

const VITALS_URL = 'https://vitals.vercel-analytics.com/v1/vitals';

export function measureWebVitals(options: AnalyticsOptions): void {
  // Only register listeners once
  if (isRegistered) return;
  isRegistered = true;

  try {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/web-vitals@2.1.4/dist/web-vitals.iife.js';
    script.onload = function () {
      // Using CDN as described in https://github.com/GoogleChrome/web-vitals
      // because of ES module import problem
      // When loading `web-vitals` using CDN, all the public
      // methods can be found on the `webVitals` global namespace.
      webVitals.getFID((metric) => sendToAnalytics(metric, options));
      webVitals.getTTFB((metric) => sendToAnalytics(metric, options));
      webVitals.getLCP((metric) => sendToAnalytics(metric, options));
      webVitals.getCLS((metric) => sendToAnalytics(metric, options));
      webVitals.getFCP((metric) => sendToAnalytics(metric, options));
    };
    document.head.appendChild(script);
  } catch (err) {
    console.error('[Analytics]', err);
  }
}

function getConnectionSpeed(): string {
  if ('connection' in navigator &&
    navigator.connection &&
    'effectiveType' in (navigator.connection as object))
    // eslint-disable-next-line dot-notation
    return navigator.connection['effectiveType'] as string

  return '';
}

function sendToAnalytics(metric: Metric, options: AnalyticsOptions) {
  const page = Object.entries(options.params).reduce(
    (acc, [key, value]) => acc.replace(value, `[${key}]`),
    options.path
  );

  const body = {
    dsn: options.analyticsId,
    id: metric.id,
    page,
    href: location.href,
    event_name: metric.name,
    value: metric.value.toString(),
    speed: getConnectionSpeed(),
  };

  if (options.debug)
    console.info('[Analytics]', metric.name, JSON.stringify(body, null, 2));


  const blob = new Blob([new URLSearchParams(body).toString()], {
    // This content type is necessary for `sendBeacon`:
    type: 'application/x-www-form-urlencoded',
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(VITALS_URL, blob);
  } else
  {fetch(VITALS_URL, {
    body: blob,
    method: 'POST',
    credentials: 'omit',
    keepalive: true,
  });}
}

