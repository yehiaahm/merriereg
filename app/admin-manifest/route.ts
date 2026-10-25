import { NextResponse } from 'next/server';

// Web app manifest for installing the admin dashboard to a phone's Home
// Screen. Only linked from admin pages (not the storefront), and scope is the
// whole site so the sign-in page (/account/login) stays inside the app. iOS only
// delivers web push to Home Screen web apps, so this
// is what makes notifications possible on iPhone. Contains nothing private.
export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(
    {
      name: 'MERRIER Admin',
      short_name: 'MERRIER Admin',
      description: 'MERRIER store admin — orders and notifications.',
      id: '/admin',
      start_url: '/admin/orders',
      scope: '/',
      display: 'standalone',
      background_color: '#1c1712',
      theme_color: '#1c1712',
      icons: [
        { src: '/push/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/push/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/push/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  );
}
