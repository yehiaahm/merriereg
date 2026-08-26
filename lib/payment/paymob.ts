import { createHmac } from 'crypto';

/**
 * Paymob integration (online card payment).
 *
 * This is a complete, structurally-correct implementation of Paymob's
 * classic Accept flow (auth token -> order registration -> payment key ->
 * hosted iframe -> webhook), but it has NOT been tested end-to-end against
 * a live Paymob account, because no PAYMOB_* credentials are available in
 * this environment. Before going live:
 *   1. Set PAYMOB_API_KEY / PAYMOB_INTEGRATION_ID / PAYMOB_IFRAME_ID /
 *      PAYMOB_HMAC_SECRET from the Paymob dashboard.
 *   2. Run one real test-mode payment and compare the webhook payload
 *      against the field list in `verifyPaymobHmac` below — Paymob's HMAC
 *      field order is dashboard/integration-specific and must match exactly
 *      or every webhook will be (correctly) rejected as unverified.
 *
 * Until PAYMOB_API_KEY is set, `isPaymobConfigured()` returns false and
 * checkout only offers Cash on Delivery — there is no fake "online payment"
 * path.
 */

const PAYMOB_BASE_URL = 'https://accept.paymob.com/api';

export function isPaymobConfigured(): boolean {
  return Boolean(
    process.env.PAYMOB_API_KEY &&
      process.env.PAYMOB_INTEGRATION_ID &&
      process.env.PAYMOB_IFRAME_ID &&
      process.env.PAYMOB_HMAC_SECRET
  );
}

interface PaymobBillingData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  street: string;
  city: string;
  country: string;
  apartment?: string;
  building?: string;
  floor?: string;
}

async function getAuthToken(): Promise<string> {
  const res = await fetch(`${PAYMOB_BASE_URL}/auth/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.PAYMOB_API_KEY }),
  });
  if (!res.ok) throw new Error(`Paymob auth failed: ${res.status}`);
  const data = await res.json();
  return data.token as string;
}

async function registerOrder(authToken: string, orderNumber: string, amountCents: number): Promise<number> {
  const res = await fetch(`${PAYMOB_BASE_URL}/ecommerce/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: amountCents,
      currency: 'EGP',
      merchant_order_id: orderNumber,
      items: [],
    }),
  });
  if (!res.ok) throw new Error(`Paymob order registration failed: ${res.status}`);
  const data = await res.json();
  return data.id as number;
}

async function requestPaymentKey(
  authToken: string,
  paymobOrderId: number,
  amountCents: number,
  billingData: PaymobBillingData
): Promise<string> {
  const res = await fetch(`${PAYMOB_BASE_URL}/acceptance/payment_keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: paymobOrderId,
      billing_data: billingData,
      currency: 'EGP',
      integration_id: Number(process.env.PAYMOB_INTEGRATION_ID),
    }),
  });
  if (!res.ok) throw new Error(`Paymob payment key request failed: ${res.status}`);
  const data = await res.json();
  return data.token as string;
}

/**
 * Runs the full Paymob flow and returns the hosted-iframe URL to redirect
 * the customer to, along with Paymob's own numeric order id. `amountPiastres`
 * is in piastres (our internal unit) and is converted to Paymob's
 * "amount_cents" (also 1/100 of EGP — same unit).
 *
 * The caller MUST persist `paymobOrderId` on the corresponding Order row
 * before the customer can complete payment — the webhook handler refuses to
 * mark an order paid unless the incoming transaction's `order.id` matches
 * this exact value (see verifyPaymobHmac's HMAC_FIELDS comment below for why
 * that check can't be skipped).
 */
export async function createPaymobPaymentUrl(params: {
  orderNumber: string;
  amountPiastres: number;
  billingData: PaymobBillingData;
}): Promise<{ url: string; paymobOrderId: number }> {
  if (!isPaymobConfigured()) {
    throw new Error('Paymob is not configured (missing PAYMOB_* environment variables)');
  }
  const authToken = await getAuthToken();
  const paymobOrderId = await registerOrder(authToken, params.orderNumber, params.amountPiastres);
  const paymentToken = await requestPaymentKey(authToken, paymobOrderId, params.amountPiastres, params.billingData);
  const url = `${PAYMOB_BASE_URL}/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;
  return { url, paymobOrderId };
}

// Fields Paymob concatenates (in this exact order) to compute the webhook
// HMAC, per Paymob's documented "Transaction processed" callback. Verify
// this against a real sandbox webhook payload before relying on it.
//
// Security-critical: this list covers `order.id` (Paymob's own numeric id)
// but NOT `order.merchant_order_id` (ours). That field is attacker-editable
// without invalidating the signature — a validly-signed webhook from any
// unrelated real transaction can be replayed with its merchant_order_id
// swapped to target a different order. The webhook handler MUST resolve the
// order via `order.id` matched against the Order.paymobOrderId stored at
// checkout time, never merchant_order_id alone. Do not "fix" this by adding
// merchant_order_id here — it is Paymob's field list, not ours to redefine.
const HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
] as const;

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export function verifyPaymobHmac(transaction: Record<string, unknown>, providedHmac: string): boolean {
  if (!process.env.PAYMOB_HMAC_SECRET) return false;
  const concatenated = HMAC_FIELDS.map((field) => String(getPath(transaction, field) ?? '')).join('');
  const computed = createHmac('sha512', process.env.PAYMOB_HMAC_SECRET).update(concatenated).digest('hex');
  return computed === providedHmac;
}
