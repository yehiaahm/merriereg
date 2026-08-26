import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mr-footer">
      <div className="mr-container">
        <div className="mr-footer-top">
          <div className="mr-footer-brand">
            <div className="mr-wordmark">
              <span className="mr-wordmark-dot" />
              MERRIER
            </div>
            <p className="mr-lede" style={{ fontSize: 13, maxWidth: '32ch' }}>
              Elevated essentials and statement silhouettes. Est. 2024.
            </p>
          </div>
          <div className="mr-footer-links">
            <div className="mr-footer-col">
              <span className="mr-eyebrow">Shop</span>
              <Link href="/#collection">The New Era</Link>
              <Link href="/products">All Products</Link>
            </div>
            <div className="mr-footer-col">
              <span className="mr-eyebrow">Brand</span>
              <Link href="/#about">The Brand</Link>
              <a href="https://instagram.com/merriereg" target="_blank" rel="noopener">
                Instagram
              </a>
            </div>
          </div>
        </div>
        <div className="mr-footer-bottom">
          <span>&copy; {new Date().getFullYear()} MERRIER. All rights reserved.</span>
          <span>ESTD 2024</span>
        </div>
      </div>
    </footer>
  );
}
