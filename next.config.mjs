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

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  // Google Fonts stylesheet, loaded via a <link> in app/layout.tsx.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Product images are admin-pasted links to arbitrary hosts (see images.remotePatterns below).
  "img-src 'self' data: https:",
  // Google Fonts serves the actual font files from a separate host.
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self'",
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
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
