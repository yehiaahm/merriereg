# MERRIER

A real, working e-commerce store for the MERRIER streetwear brand — Phase 1: the
core sell-path (admin adds product → storefront shows it → cart → checkout →
COD/online payment → order → admin manages it), built on Next.js + Prisma +
PostgreSQL, production-ready for Railway.

## Stack

- **Next.js 16** (App Router, TypeScript) — pages, API routes, middleware-based auth.
- **PostgreSQL everywhere** — local dev and production both run on real Postgres
  (a local instance is started automatically, no Docker/manual install needed —
  see below). There is no separate SQLite-for-dev path to drift out of sync
  with what actually runs on Railway.
- **No customer accounts in Phase 1** — checkout is guest-only by design.
- **Payments** — Cash on Delivery works today. Paymob (cards + Apple Pay) is
  fully wired up in code but needs real API keys — see below.
- **Product images** are referenced by URL (admin pastes a link to wherever
  the image is hosted) — nothing is written to the app server's own
  filesystem, so there's nothing that could be lost on a Railway
  restart/redeploy.

## Local development

```bash
npm install
npm run db:local     # starts a real local Postgres (first run only downloads/initialises it)
npm run db:migrate   # applies the schema
npm run db:seed      # loads 2 sample products so there's something to test with
npm run dev
```

Or just run `run-all.bat` (Windows) — it does all of the above in order and
is safe to re-run any time.

Admin login: there's no separate admin login — an admin is just a customer
account with `isAdmin: true`. Sign up normally at `/account/signup`, then run
`npm run admin:promote -- you@example.com` to grant that account admin
access (this is the only way to become an admin — never possible from the
web UI). After that, signing in at `/account/login` shows an "Admin" link
and unlocks `/admin`.

Health check: `GET /health` — pings the database and returns `{status:"ok"}` /
200, or `{status:"error"}` / 503 if it can't reach Postgres.

> **This machine has a global `DATABASE_URL` env var** pointing at an unrelated
> project's Postgres database. To make that collision impossible, this project
> deliberately uses `MERRIER_DATABASE_URL` instead of the conventional
> `DATABASE_URL` name (see `prisma/schema.prisma`). Keep that in mind if you
> ever rename it back.

## Required environment variables

| Variable | Required | Notes |
|---|---|---|
| `MERRIER_DATABASE_URL` | **Yes** | Postgres connection string. The app fails fast at startup with a clear message if this is missing. |
| `CUSTOMER_SESSION_SECRET` | **Yes** | Random 32-byte hex string signing customer (and admin) session cookies — one sign-in system for both. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `PORT` | No (Railway sets it) | The app listens on this port — never hardcoded. Defaults to 3000 locally. |
| `NEXT_PUBLIC_SITE_URL` | No | Used for absolute URLs (e.g. Paymob billing data). |
| `PAYMOB_API_KEY` / `PAYMOB_INTEGRATION_ID` / `PAYMOB_IFRAME_ID` / `PAYMOB_HMAC_SECRET` | No | Leave unset to run Cash-on-Delivery only — see below. |

`scripts/start.mjs` checks for the three required variables before the server
starts and exits with a clear error naming exactly what's missing, rather than
booting successfully and failing cryptically on the first request.

## Deploying to Railway

1. **Push this repo to GitHub** and create a new Railway project from it.
2. **Add a Postgres database** to the Railway project ("New" → "Database" → "PostgreSQL").
3. **Set environment variables** on the app service (Variables tab):
   - `MERRIER_DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (references the Postgres plugin)
   - `CUSTOMER_SESSION_SECRET` = a random 32-byte hex string (see above)
   - `NEXT_PUBLIC_SITE_URL` = your Railway domain (e.g. `https://merrier.up.railway.app`)
   - `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_IFRAME_ID`, `PAYMOB_HMAC_SECRET`
     — only once you have a real Paymob account (see below).
   - **Do not set `PORT`** — Railway injects it automatically and the app reads it.
4. Railway auto-detects Next.js via Nixpacks/Railpack and runs `npm install`,
   then `npm run build` (`prisma generate && next build` — no database
   connection needed here), then `npm start` (`scripts/start.mjs`, which
   resolves `PORT`, fails fast if required vars are missing, runs
   `prisma migrate deploy`, and only then starts the server). No extra config
   needed — no Dockerfile, no `railway.json`.

   Migrations deliberately run in `start`, not `build`: Railway's build step
   runs in an isolated builder sandbox with no route to Railway's private
   network (hosts like `postgres.railway.internal`), so `prisma migrate
   deploy` there fails with `P1001: Can't reach database server` even though
   the same database is perfectly reachable once the container is actually
   deployed and running.
5. Once deployed, point Railway's health check at `GET /health` if you want
   Railway to actively monitor DB connectivity (Settings → Healthcheck Path).
6. After the first deploy, either run the seed script once against
   production (`MERRIER_DATABASE_URL=<railway-postgres-url> npm run db:seed`
   from your machine) or just add real products from `/admin`. To get into
   `/admin` at all, sign up an account on the live site, then run
   `MERRIER_DATABASE_URL=<railway-postgres-url> npm run admin:promote -- you@example.com`
   from your machine.

This exact sequence — fresh Postgres → `next build` → `npm start` (which runs
`prisma migrate deploy` then starts the server) on a Railway-style `PORT` —
was tested end-to-end locally against a real (not mocked) PostgreSQL
instance before this was written.

## Enabling Paymob (online card + Apple Pay)

The full integration (auth → order → payment key → hosted checkout iframe →
webhook verification) is implemented in `lib/payment/paymob.ts` and
`app/api/webhooks/paymob/route.ts`, but **has not been tested against a live
Paymob account** — there were no credentials available while building this.
Secrets (`PAYMOB_API_KEY`, `PAYMOB_HMAC_SECRET`, etc.) are read only from
server-side env vars and never sent to the browser. Before relying on it:

1. Get a Paymob merchant account approved and grab your API key, integration
   ID, iframe ID and HMAC secret from their dashboard.
2. Set the four `PAYMOB_*` env vars above.
3. Set your webhook URL in the Paymob dashboard to
   `https://<your-domain>/api/webhooks/paymob`.
4. Run one real test-mode payment and compare the webhook payload's fields
   against the `HMAC_FIELDS` list in `lib/payment/paymob.ts` — Paymob's exact
   field order can vary by integration and must match exactly or every
   webhook will be (correctly) rejected as unverified.

Until this is done, checkout simply doesn't offer online payment — the
`PAYMOB_CARD` option is refused server-side with a clear error rather than
faking a successful payment. Order status and payment status are tracked as
separate fields throughout (an order can be `CONFIRMED` while its payment is
still `PENDING`, for Cash on Delivery).

## Smart Size Finder ("Find my size")

A button next to the size selector on every product page that opens a form
(height, weight, optional chest/waist/etc., preferred fit) and recommends a size
**from that product's own size chart** — never from BMI or generic weight
brackets. "Apply this size" selects the real variant, so add-to-cart and
checkout are unchanged.

**There is no built-in sizing data.** A product shows the finder only when it has
a *verified* size chart; otherwise it says recommendations aren't available.
Nothing is estimated or pre-filled.

### Entering size charts (admin)

`/admin/size-charts` → *Add Size Chart*:

- **Body vs garment** — say whether the numbers describe the body a size is for,
  or the garment itself. Garment numbers are converted to a body size with the
  **ease** you enter (how much roomier the garment is than the body, from your
  tech pack). Garment columns without ease are shown to customers but never used
  for matching.
- Units are fixed: cm for lengths/circumferences, kg for weight. Enter min–max per
  size (one number = exact), sizes smallest → largest. Optional: cut, fabric
  stretch, a note.
- **Source** is required to mark a chart **Verified**; unverified charts are drafts
  and never reach the storefront. The server rejects impossible values, duplicate
  sizes, sizes out of order, and a verified chart with nothing comparable.
- Assign a chart as the default for **categories** (on the chart page) or to a
  **single product** (on the product page; it overrides the category chart). A
  product whose own chart is unverified gets no recommendation — it does not fall
  back to the category chart.

### How a recommendation is made (`lib/sizing/`)

1. Each chart size becomes a body range per measurement (garment − ease for garment charts).
2. Each size is scored by how far the customer's measurements fall outside its
   ranges, measured in "size steps" of that chart. Too tight counts more than too
   loose unless the fabric stretches. Height/weight only nudge the score when a
   body measurement is given; on their own they are a *preliminary* estimate.
3. If the next size is nearly as good they're **between sizes**: preferred fit
   (or fabric stretch) picks one and the other is offered as an alternative.
   If height/weight can't separate sizes, the finder asks for chest/waist instead of guessing.
4. Only **active, in-stock** sizes in the **selected color** are recommended. If the
   best match is unavailable it says so and suggests a neighbour only when that
   size is a close match for the measurements.
5. Confidence (high/medium/low) reflects data quality: body vs garment-derived
   data, height/weight only, between sizes, conflicting measurements, edge of the
   chart, or a substituted size. It never claims certainty.

**Privacy:** the calculation runs in the browser. Measurements are not sent to
the server, stored, or tied to an account; the form says so.

### Tests

```bash
npm run test:sizing   # engine, validation, chart schema + DB-backed flow (needs `npm run db:local`)
```

Test charts are synthetic fixtures and are removed afterwards. Run
`npx prisma migrate deploy` to apply the `add_size_charts` migration.

### Size data status

Charts supplied by the store owner live in `scripts/size-chart-data.mjs` and are
loaded with:

```bash
npm run db:seed-size-charts   # idempotent; safe to re-run, also from Railway's Console
```

| Category / products | Status |
|---|---|
| Pants: the four Wide Leg Sweatpants | **On** — height-suggestion table (XS–XL) plus garment waist/length. Height-only, so results are labelled preliminary (medium confidence at best). XS exists in the chart but isn't made, so a very short customer is told XS is unavailable. |
| Hoodie chart | Saved, **not assigned** (no hoodie product yet). Assign it on a product's edit page when one exists. |
| T-Shirts: Black / Beige / Olive Acid Washed Oversized Tee | **Off** — no chart yet. Needs chest garment measurements (flat or round) and the intended ease for the oversized cut. |
| Shorts: Black Waffle Knit / Grey Waffle Short | **Off** — no chart yet. Needs waist, hips, inseam and ease/stretch. |

To make sweatpant results more reliable (high confidence), add the **ease** for
waist (how much roomier the garment is than the body) and say whether the waist
was measured flat — then the garment waist is compared too, not just height.
Also confirm each fabric's stretch (none/low/moderate/high).

## What's deliberately NOT in Phase 1

Wishlists, reviews, real shipment tracking, returns/exchanges. These were
explicitly scoped out to ship a working core sell-path first. (Customer
accounts exist, but guest checkout is still fully supported and remains the
default — no account is ever required to buy.)

## Project structure

- `app/(storefront)/` — public site: home, `/products`, `/product/[slug]`, `/cart`, `/checkout`, `/order/[id]`, `/account` (+ `/account/login`, `/account/signup`).
- `app/admin/(authenticated)/` — the admin app. No separate login route: access is gated purely by the signed-in customer's `isAdmin` flag.
- `app/api/` — cart, checkout, account (signup/login/logout), admin CRUD, Paymob webhook.
- `app/health/route.ts` — health check (pings the database).
- `proxy.ts`* — real backend authorization for every `/admin` and `/api/admin` route (not just hidden UI) — checks the `admin` claim on the customer session cookie.
- `scripts/start.mjs` — production start: resolves `PORT`, fails fast on missing required env vars.
- `scripts/local-postgres.mjs` — starts the local dev Postgres instance (idempotent).
- `scripts/make-admin.ts` — promotes an existing customer account to admin (`npm run admin:promote -- email`); the only way to become one.
- `lib/` — Prisma client, cart/order/shipping business logic, customer auth (shared by admin), Paymob integration, zod validation schemas.
- `prisma/schema.prisma` — the full data model (products, variants, images, cart, orders, payments).

<sub>*renamed to `proxy.ts` by Next.js 16's own convention — same file, same logic.</sub>

## Design source files

`Main.dc.html` / `canvas.json` / `merrier-landing.html` are the original
marketing-page design source (built with Claude Design) — not part of the
running app, kept for reference if the storefront's visual design needs
revisiting.
