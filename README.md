# ulivo

ulivo turns a recipe URL into an ad-free, step-by-step cooking guide. Paste a link to import a recipe, then cook one step at a time. Billing uses Dodo Payments and stays disabled until its env vars are set.

## Stack

- Turborepo and pnpm
- `apps/web`: Next.js App Router, Tailwind CSS, shadcn-style components in `modules/ui`, next-intl (`de`, `en`)
- `apps/mobile`: Expo SDK 58 and Expo Router. It calls the OpenAPI routes under `/api` (not the oRPC client).
- `packages/database`: Drizzle ORM and Neon Postgres
- `packages/auth`: better-auth, email magic link and Google
- `packages/api`: oRPC, a typed client, and an OpenAPI document
- `packages/payments`: Dodo Payments credit packs, ledger, and webhooks
- `packages/ai`: Vercel AI SDK through AI Gateway, plus the recipe schema

UI follows the supastarter Next.js setup: tokens in `tooling/tailwind/theme.css`, `cn` in `@ui/lib`, components in `apps/web/modules/ui`, and dark mode with `next-themes` (`class` on `html`). The palette is ulivo's: cream background, olive and lime, PT Serif headings, Source Sans 3 for body text.

## Setup

1. Install dependencies.

```bash
pnpm install
```

2. Copy the env file and fill it in.

```bash
cp .env.example .env
```

`BETTER_AUTH_SECRET` must be at least 32 characters. `openssl rand -base64 32` works.

3. Create a Neon project in `aws-us-east-1`, `aws-us-east-2`, `aws-eu-central-1`, or `aws-ap-southeast-1` (object storage is limited to those regions). Put the pooled connection string in `DATABASE_URL` and the direct string in `DATABASE_URL_UNPOOLED`. Create a `public_read` bucket for icons and set `S3_BUCKET` to its name. `neon env pull` fills `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`. Set `S3_PUBLIC_URL` only if a CDN sits in front of that bucket.

4. Apply the schema.

```bash
pnpm --filter @repo/database migrate
```

`db:push` is the alternative when you do not want migration files.

5. Start the app.

```bash
pnpm dev
```

Open http://localhost:3000. The locale follows the browser. German is the fallback, at `/`. English is at `/en`.

## Mobile

```bash
pnpm --filter @repo/mobile dev
```

`EXPO_PUBLIC_API_URL` in `apps/mobile/.env` is the site origin. It defaults to `https://ulivo.app`. Copy `apps/mobile/.env.example` when you want a local API.

Sign-in uses the `ulivo://` scheme. A development build (`npx expo run:ios` or `npx expo run:android` from `apps/mobile`) can return from the magic link and from Google. Expo Go uses `exp://`, which the auth server trusts only while `NODE_ENV` is `development`.

The app shows the credit balance and history. It does not sell credits and does not link to a checkout page.

## API

| Path                          | What it is                                                       |
| ----------------------------- | ---------------------------------------------------------------- |
| `POST /api/rpc`               | Typed oRPC endpoint used by `apps/web/modules/shared/lib/api.ts` |
| `GET /api/health`             | Health check                                                     |
| `GET /api/me`                 | Current user, or `null`                                          |
| `GET /api/openapi`            | OpenAPI document. `apps/mobile` calls these routes directly      |
| `GET /api/billing/packs`      | Credit packs: 10 / 20 / 50 recipes and their USD prices          |
| `GET /api/billing/balance`    | Signed-in balance, or zero when logged out                       |
| `GET /api/billing/history`    | Purchases, welcome credits, imports, refunds                     |
| `POST /api/billing/checkout`  | Dodo checkout URL for one pack                                   |
| `POST /api/recipes/import`    | Import a recipe URL. A new import needs an account and 1 credit  |
| `GET /api/recipes/starters`   | Free curated starter dishes                                      |
| `GET /api/recipes/{recipeId}` | Stored recipe for the requested locale                           |
| `POST /api/webhooks/dodo`     | Dodo Payments webhook                                            |
| `/api/auth/*`                 | better-auth (magic link and Google)                              |

The same procedures are available through `POST /api/rpc`, including `billing.packs`, `billing.balance`, `billing.history`, `billing.createCheckout`, and `recipes.import`.

There is no monthly fee. A verified account receives 3 welcome credits on the first login. Each new import or translation costs 1 credit. A recipe already stored for that language does not cost a credit. Curated starter recipes are free, including when someone pastes their source URL. Icon generation does not write an `imports` row or a ledger debit. When the balance is too low, import returns `INSUFFICIENT_CREDITS` (HTTP 402) and the home page opens the buy-credits dialog.

Pack prices live in `packages/payments/config.ts`: 10 recipes for $5.00 ($0.50 each), 20 for $9.00 ($0.45 each), and 50 for $20.00 ($0.40 each). The same file holds per-model token prices and a margin used only to record what a generation cost. The charge stays 1 credit.

`@dodopayments/better-auth` and `@dodopayments/nextjs` mount their own checkout and webhook routes. This app needs the calls in the OpenAPI document and a credit ledger, so billing uses the official `dodopayments` SDK directly. Signature checks use `standardwebhooks`, the same library the SDK uses.

Magic-link emails go out through Resend when `RESEND_API_KEY` is set. Without that key, development prints the link in the server log and production refuses to send. The sender is `ulivo <noreply@ulivo.app>` unless `EMAIL_FROM` is set. Google sign-in is registered only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set.

`extractRecipe` in `@repo/ai` calls AI Gateway. It uses `AI_GATEWAY_MODEL` when that is set, and `google/gemini-2.5-flash-lite` otherwise. It does not fetch a URL. Each ingredient includes `canonicalKey`, an English singular name used as the icon cache key.

## Icons

`packages/icons` draws one hero icon per recipe and one shared icon per ingredient. Ingredient icons are cached on `canonicalKey` after it is lowercased and hyphenated, so the same English key is reused across recipes. Generation is queued by `POST /api/icons/schedule` and continues in `after()`, so the import response does not wait. It does not write an `imports` row.

`GET /api/icons?recipeId=` returns status and URL. `RecipeIcons` polls that until every icon is `ready` or `failed`. The home page shows the empty clay placeholder.

Without `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`, generation writes a local WebP mock. Set `ICON_GENERATION_MODE=live` to require the gateway. The default image model is `google/gemini-3.1-flash-image-preview` (`AI_GATEWAY_IMAGE_MODEL`).

Icon files go to Neon Object Storage through a path-style S3 client. Required env vars are `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `S3_BUCKET`. `S3_PUBLIC_URL` is optional. With any of those required values empty, the upload is written under `.data/icons` and served at `/icons/{kind}/{file}`. Build and typecheck do not need the credentials.

## Environment

Every variable is listed in `.env.example`. None are required for `pnpm type-check` or `pnpm build`.

| Variable                           | Purpose                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`              | Public origin, default `http://localhost:3000`                         |
| `BETTER_AUTH_SECRET`               | Session secret, at least 32 characters                                 |
| `BETTER_AUTH_URL`                  | Auth base URL, usually the same as the app origin                      |
| `DATABASE_URL`                     | Neon pooled Postgres URL for the app                                   |
| `DATABASE_URL_UNPOOLED`            | Neon direct Postgres URL for Drizzle migrations                        |
| `GOOGLE_CLIENT_ID`                 | Google OAuth client id. Both Google vars must be set together          |
| `GOOGLE_CLIENT_SECRET`             | Google OAuth client secret                                             |
| `RESEND_API_KEY`                   | Resend key for magic-link email. Empty keeps the dev server log        |
| `EMAIL_FROM`                       | Optional sender. Default `ulivo <noreply@ulivo.app>`                   |
| `AI_GATEWAY_API_KEY`               | Vercel AI Gateway key for local extraction and live icons              |
| `AI_GATEWAY_MODEL`                 | Optional extraction model. Default `google/gemini-2.5-flash-lite`      |
| `AI_GATEWAY_IMAGE_MODEL`           | Image model for icons. Default `google/gemini-3.1-flash-image-preview` |
| `ICON_GENERATION_MODE`             | `mock`, `live`, or empty (mock when no gateway credential is present)  |
| `VERCEL_OIDC_TOKEN`                | Gateway auth on Vercel. Injected there. Leave empty locally            |
| `AWS_ENDPOINT_URL_S3`              | Neon Object Storage endpoint for this branch                           |
| `AWS_ACCESS_KEY_ID`                | Neon storage access key id                                             |
| `AWS_SECRET_ACCESS_KEY`            | Neon storage secret                                                    |
| `AWS_REGION`                       | Neon storage region, such as `us-east-2`                               |
| `S3_BUCKET`                        | `public_read` bucket name for icon WebP files                          |
| `S3_PUBLIC_URL`                    | Optional CDN origin. Empty uses `{endpoint}/{bucket}/{key}`            |
| `DODO_PAYMENTS_API_KEY`            | Dodo Payments API key. Empty disables checkout                         |
| `DODO_PAYMENTS_WEBHOOK_SECRET`     | Signing secret for `POST /api/webhooks/dodo`                           |
| `DODO_PAYMENTS_ENVIRONMENT`        | `test_mode` or `live_mode`. Any other value disables billing           |
| `DODO_PAYMENTS_CREDITS_PRODUCT_ID` | Pay What You Want one-time product used for every credit pack          |

## Billing

Prices are USD, in `packages/payments/config.ts`. Changing a pack price there does not require a new Dodo product. Checkout sends `billing_currency: USD` and sets the Pay What You Want amount in cents on `product_cart`.

Dodo mechanism: one Pay What You Want one-time product. The Checkout Sessions API field `product_cart[].amount` is the price in the smallest currency unit (cents). Session `metadata` is copied onto the payment, so `payment.succeeded` includes `data.metadata`. Refund and dispute events identify `payment_id`; the credit reversal uses the purchase already stored for that payment.

- [Dynamic pricing checkout](https://docs.dodopayments.com/developer-resources/dynamic-pricing-checkout)
- [Pay What You Want](https://docs.dodopayments.com/features/pay-what-you-want)
- [Checkout sessions](https://docs.dodopayments.com/developer-resources/checkout-session)
- [Metadata](https://docs.dodopayments.com/api-reference/metadata)
- [Payment webhooks](https://docs.dodopayments.com/developer-resources/webhooks/intents/payment)

In the Dodo Payments dashboard:

1. Create one **one-time** product (not a subscription) and turn on Pay What You Want. Set the minimum price to $0.50, which is at or below every pack in `packages/payments/config.ts`. A higher minimum rejects cheaper packs at checkout. Copy the product id into `DODO_PAYMENTS_CREDITS_PRODUCT_ID`. Leave the price in USD. Do not add a converted EUR price.
2. Create an API key under Developer → API Keys. Use a test key with `DODO_PAYMENTS_ENVIRONMENT=test_mode`, or a live key with `live_mode`.
3. Add a webhook endpoint under Developer → Webhooks. The URL is `https://<your-domain>/api/webhooks/dodo`. Copy the signing secret into `DODO_PAYMENTS_WEBHOOK_SECRET`.
4. Subscribe that endpoint to `payment.succeeded`, `payment.failed`, `payment.processing`, `payment.cancelled`, `refund.succeeded`, `refund.failed`, `dispute.opened`, `dispute.expired`, `dispute.accepted`, `dispute.cancelled`, `dispute.challenged`, `dispute.won`, and `dispute.lost`.

Before checkout, the server writes a `credit_checkouts` row with the pack, credits, and price from config. `payment.succeeded` grants that row only when the metadata pack and credits match it and the amount paid before tax is at least that price, or lower because the payment includes a Dodo discount. A mismatch is stored on the row and does not grant credits. The grant is stored once per payment id, and the webhook id is stored, so a retry does not grant twice. `refund.succeeded`, `dispute.lost`, `dispute.accepted`, and `dispute.expired` debit those credits once per payment. The other events are acknowledged and do not change the balance.

Welcome credits are a ledger row of type `welcome`. The normalized email is stored in `welcome_emails`, which has no foreign key, so deleting the account does not free the email for another grant. Gmail addresses lose dots and `+tags`. Known disposable domains do not receive the grant.

Set the API key, webhook secret, environment, and `DODO_PAYMENTS_CREDITS_PRODUCT_ID` in Vercel before charging cards. If any of those is missing, checkout returns `BILLING_DISABLED` and the app still builds. Welcome credits still work.

## Curated recipes

`pnpm seed:curated` upserts the fixtures in `packages/database/seed/recipes.ts`. Each row is `is_curated = true` and `source = 'curated'`. The homepage shows 4 to 6 of them at random when that many exist. Viewing, cooking, saving, or opening one by its source URL does not debit a credit and does not record token usage. A user import cannot set those flags. Add real dishes to the fixture list and run the script again. Generation for those dishes stays in the operator script, not on the user's account.

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm type-check
pnpm --filter @repo/database db:generate
pnpm --filter @repo/database migrate
pnpm seed:curated
```
