// From https://ivoberger.com/posts/using-vercel-analytics-with-svelte-kit/ which was from https://github.com/vercel/gatsby-plugin-vercel/blob/main/src/web-vitals.js

import type { Metric } from 'web-vitals';
// import { getCLS, getFCP, getFID, getLCP, getTTFB } from 'web-vitals';

let isRegistered = false;

export type AnalyticsOptions = {
  params: { [s: string]: any } | ArrayLike<any>;
  path: string;
  analyticsId: string;
  debug?: true;
};

const vitalsUrl = 'https://vitals.vercel-analytics.com/v1/vitals';

function getConnectionSpeed(): string {
  return 'connection' in navigator &&
    navigator['connection'] &&
    'effectiveType' in navigator['connection']
    ? navigator['connection']['effectiveType']
    : '';
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

  if (options.debug) {
    console.log('[Analytics]', metric.name, JSON.stringify(body, null, 2));
  }

  const blob = new Blob([new URLSearchParams(body).toString()], {
    // This content type is necessary for `sendBeacon`:
    type: 'application/x-www-form-urlencoded',
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(vitalsUrl, blob);
  } else
    fetch(vitalsUrl, {
      body: blob,
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
    });
}

export function measureWebVitals(options: AnalyticsOptions): void {
  // Only register listeners once
  if (isRegistered) return;
  isRegistered = true;

  try {
    const script = document.createElement('script');
    // script.src = 'https://unpkg.com/web-vitals/dist/web-vitals.iife.js';
    script.src = 'https://unpkg.com/web-vitals@2.1.4/dist/web-vitals.iife.js';
    script.onload = function () {
      // Using CDN as described in https://github.com/GoogleChrome/web-vitals
      // because of ES module import problem
      // When loading `web-vitals` using CDN, all the public
      // methods can be found on the `webVitals` global namespace.
      //@ts-ignore
      webVitals.getFID((metric) => sendToAnalytics(metric, options));
      //@ts-ignore
      webVitals.getTTFB((metric) => sendToAnalytics(metric, options));
      //@ts-ignore
      webVitals.getLCP((metric) => sendToAnalytics(metric, options));
      //@ts-ignore
      webVitals.getCLS((metric) => sendToAnalytics(metric, options));
      //@ts-ignore
      webVitals.getFCP((metric) => sendToAnalytics(metric, options));
    };
    document.head.appendChild(script);
  } catch (err) {
    console.error('[Analytics]', err);
  }
}
