// Better Stack JavaScript tag (components/BetterStackTag.tsx): the loader
// script comes from betterstack.net, and it sends errors, web vitals, events
// and session replays back to Better Stack's ingest hosts.
const betterStackScriptHosts = 'https://betterstack.net https://*.betterstack.net';
const betterStackConnectHosts = 'https://betterstack.net https://*.betterstack.net https://*.betterstackdata.com';

// The storefront never embeds any third-party iframe/script (Paymob's hosted
// payment page is a full-page redirect via window.location.href, not an
// iframe on our own pages — see components/CheckoutForm.tsx), so the CSP
// below can stay tight. script-src/style-src keep 'unsafe-inline' because
// Next.js's own hydration bootstrap and this app's inline `style={{}}` usage
// need it; there is no dangerouslySetInnerHTML anywhere in the codebase, so
// the main XSS backstop is React's default output escaping, not the CSP.
// React/Turbopack's dev-mode client uses eval() for debugging (never in a
// production build — see React's own console warning), so 'unsafe-eval' is
// scoped to development only rather than weakening the production policy.
const isDev = process.env.NODE_ENV !== 'production';
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const posthogAssetsHost = posthogHost?.replace('.i.posthog.com', '-assets.i.posthog.com');

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}${posthogAssetsHost ? ` ${posthogAssetsHost}` : ''} ${betterStackScriptHosts}`,
  // Google Fonts stylesheet, loaded via a <link> in app/layout.tsx.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Product images are admin-pasted links to arbitrary hosts (see images.remotePatterns below);
  // this also covers Leaflet's OpenStreetMap tile images for the Checkout/Admin delivery-location map.
  "img-src 'self' data: https:",
  // Google Fonts serves the actual font files from a separate host.
  "font-src 'self' data: https://fonts.gstatic.com",
  // nominatim.openstreetmap.org: reverse-geocodes the Delivery Location picker's
  // confirmed coordinates into a human-readable address (no API key needed).
  `connect-src 'self' https://nominatim.openstreetmap.org${posthogHost ? ` ${posthogHost}` : ''} ${betterStackConnectHosts}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // No `output: 'standalone'` — Railway's Nixpacks builder runs `npm run
  // build` + `npm start` directly in a full node_modules environment, so
  // standalone (meant for minimal Docker images) isn't needed and actually
  // breaks plain `next start`.
  agentRules: false,
  // Don't advertise the framework in an X-Powered-By response header.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async headers() {
    return [
      {
        // The push service worker must never be served stale from a cache, or
        // a bug fix to notification handling could take days to reach phones.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // geolocation=(self): the Checkout's "Use My Current Location" button needs
          // navigator.geolocation on our own origin — still opt-in only, the browser's
          // own permission prompt gates every actual request (see DeliveryLocationPicker.tsx).
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
