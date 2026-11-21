import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Suspense } from 'react';
import { ScrollAnimationHandler } from '@/components/ScrollAnimationHandler';
import { MetaPixel } from '@/components/MetaPixel';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mr-page">
      <div className="mr-grain" />
      <ScrollAnimationHandler />
      {/* useSearchParams needs a Suspense boundary; renders nothing. */}
      <Suspense fallback={null}>
        <MetaPixel />
      </Suspense>
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
