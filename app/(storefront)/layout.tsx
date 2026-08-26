import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { ScrollAnimationHandler } from '@/components/ScrollAnimationHandler';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mr-page">
      <div className="mr-grain" />
      <ScrollAnimationHandler />
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
