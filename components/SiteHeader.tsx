import { getCurrentCart, cartTotals } from '@/lib/cart';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getCurrentWishlist } from '@/lib/wishlist';
import { PromoBar } from '@/components/PromoBar';
import { SiteHeaderNav } from '@/components/SiteHeaderNav';

export async function SiteHeader() {
  const [cart, customer, wishlist] = await Promise.all([getCurrentCart(), getCurrentCustomer(), getCurrentWishlist()]);
  const itemCount = cart ? cartTotals(cart).itemCount : 0;
  const wishlistCount = wishlist?.items.length ?? 0;

  return (
    <>
      <PromoBar />
      <SiteHeaderNav
        itemCount={itemCount}
        wishlistCount={wishlistCount}
        customerName={customer?.name ?? null}
        isAdmin={customer?.isAdmin ?? false}
      />
    </>
  );
}
