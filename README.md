# ulivo

ulivo turns a recipe URL into an ad-free, step-by-step cooking guide. Paste a link to import a recipe, then cook one step at a time. Billing uses Dodo Payments and stays disabled until its env vars are set.

## Stack

- Turborepo and pnpm
- `apps/web`: Next.js App Router, Tailwind CSS, shadcn-style components in `modules/ui`, next-intl (`de`, `en`)
- `packages/database`: Drizzle ORM and Neon Postgres
- `packages/auth`: better-auth, email magic link and Google
- `packages/api`: oRPC, a typed client, and an OpenAPI document
- `packages/payments`: Dodo Payments checkout, customer portal, quota, and webhooks
- `packages/ai`: Vercel AI SDK through AI Gateway, plus the recipe schema

UI follows the supastarter Next.js setup: tokens in `tooling/tailwind/theme.css`, `cn` in `@ui/lib`, components in `apps/web/modules/ui`, and dark mode with `next-themes` (`class` on `html`). The palette is ulivo's: cream background, olive and lime, Fraunces headings, Source Sans 3 for body text.

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
pnpm --filter @repo/database db:migrate
```

`db:push` is the alternative when you do not want migration files.

5. Start the app.

```bash
pnpm dev
```

Open http://localhost:3000. The locale follows the browser. German is the fallback, at `/`. English is at `/en`.

## API

| Path                          | What it is                                                       |
| ----------------------------- | ---------------------------------------------------------------- |
| `POST /api/rpc`               | Typed oRPC endpoint used by `apps/web/modules/shared/lib/api.ts` |
| `GET /api/health`             | Health check                                                     |
| `GET /api/me`                 | Current user, or `null`                                          |
| `GET /api/openapi`            | OpenAPI document for a future Expo client                        |
| `GET /api/billing/status`     | Plan, period, imports used, and limit                            |
| `POST /api/billing/checkout`  | Dodo checkout URL for the signed-in user                         |
| `POST /api/billing/portal`    | Dodo customer portal URL                                         |
| `POST /api/recipes/import`    | Import a recipe URL. A new import needs an account and quota     |
| `GET /api/recipes/{recipeId}` | Stored recipe for the requested locale                           |
| `POST /api/webhooks/dodo`     | Dodo Payments webhook                                            |
| `/api/auth/*`                 | better-auth (magic link and Google)                              |

The same procedures are available through `POST /api/rpc`, including `billing.status`, `billing.createCheckout`, `billing.portal`, and `recipes.import`.

The first import is free and requires an account. A subscription is $3.99 per month, or €3.99 in the German app, for 30 imports in the current billing period. Importing the same recipe into another language counts as a translation. A recipe already stored for that language does not count. Icon generation does not write an `imports` row. When the quota is used up, import returns `QUOTA_EXCEEDED` (HTTP 402) and the home page shows the upgrade dialog.

`@dodopayments/better-auth` and `@dodopayments/nextjs` mount their own checkout, portal, and webhook routes. This app needs the calls in the OpenAPI document and a `subscriptions` table, so billing uses the official `dodopayments` SDK directly. Signature checks use `standardwebhooks`, the same library the SDK uses.

Magic-link emails go out through Resend when `RESEND_API_KEY` is set. Without that key, development prints the link in the server log and production refuses to send. The sender is `ulivo <noreply@ulivo.app>` unless `EMAIL_FROM` is set. Google sign-in is registered only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set.

`extractRecipe` in `@repo/ai` calls AI Gateway. It uses `AI_GATEWAY_MODEL` when that is set, and `google/gemini-2.5-flash-lite` otherwise. It does not fetch a URL. Each ingredient includes `canonicalKey`, an English singular name used as the icon cache key.

## Icons

`packages/icons` draws one hero icon per recipe and one shared icon per ingredient. Ingredient icons are cached on `canonicalKey` after it is lowercased and hyphenated, so the same English key is reused across recipes. Generation is queued by `POST /api/icons/schedule` and continues in `after()`, so the import response does not wait. It does not write an `imports` row.

`GET /api/icons?recipeId=` returns status and URL. `RecipeIcons` polls that until every icon is `ready` or `failed`. The home page shows the empty clay placeholder.

Without `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`, generation writes a local WebP mock. Set `ICON_GENERATION_MODE=live` to require the gateway. The default image model is `google/gemini-3.1-flash-image-preview` (`AI_GATEWAY_IMAGE_MODEL`).

Icon files go to Neon Object Storage through a path-style S3 client. Required env vars are `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `S3_BUCKET`. `S3_PUBLIC_URL` is optional. With any of those required values empty, the upload is written under `.data/icons` and served at `/icons/{kind}/{file}`. Build and typecheck do not need the credentials.

## Environment

Every variable is listed in `.env.example`. None are required for `pnpm type-check` or `pnpm build`.

| Variable                       | Purpose                                                                |
| ------------------------------ | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`          | Public origin, default `http://localhost:3000`                         |
| `BETTER_AUTH_SECRET`           | Session secret, at least 32 characters                                 |
| `BETTER_AUTH_URL`              | Auth base URL, usually the same as the app origin                      |
| `DATABASE_URL`                 | Neon pooled Postgres URL for the app                                   |
| `DATABASE_URL_UNPOOLED`        | Neon direct Postgres URL for Drizzle migrations                        |
| `GOOGLE_CLIENT_ID`             | Google OAuth client id. Both Google vars must be set together          |
| `GOOGLE_CLIENT_SECRET`         | Google OAuth client secret                                             |
| `RESEND_API_KEY`               | Resend key for magic-link email. Empty keeps the dev server log        |
| `EMAIL_FROM`                   | Optional sender. Default `ulivo <noreply@ulivo.app>`                   |
| `AI_GATEWAY_API_KEY`           | Vercel AI Gateway key for local extraction and live icons              |
| `AI_GATEWAY_MODEL`             | Optional extraction model. Default `google/gemini-2.5-flash-lite`      |
| `AI_GATEWAY_IMAGE_MODEL`       | Image model for icons. Default `google/gemini-3.1-flash-image-preview` |
| `ICON_GENERATION_MODE`         | `mock`, `live`, or empty (mock when no gateway credential is present)  |
| `VERCEL_OIDC_TOKEN`            | Gateway auth on Vercel. Injected there. Leave empty locally            |
| `AWS_ENDPOINT_URL_S3`          | Neon Object Storage endpoint for this branch                           |
| `AWS_ACCESS_KEY_ID`            | Neon storage access key id                                             |
| `AWS_SECRET_ACCESS_KEY`        | Neon storage secret                                                    |
| `AWS_REGION`                   | Neon storage region, such as `us-east-2`                               |
| `S3_BUCKET`                    | `public_read` bucket name for icon WebP files                          |
| `S3_PUBLIC_URL`                | Optional CDN origin. Empty uses `{endpoint}/{bucket}/{key}`            |
| `DODO_PAYMENTS_API_KEY`        | Dodo Payments API key. Empty disables checkout and the portal          |
| `DODO_PAYMENTS_WEBHOOK_SECRET` | Signing secret for `POST /api/webhooks/dodo`                           |
| `DODO_PAYMENTS_ENVIRONMENT`    | `test_mode` or `live_mode`. Any other value disables billing           |
| `DODO_PAYMENTS_PRODUCT_ID`     | Monthly $3.99 subscription product id                                  |

## Billing

In the Dodo Payments dashboard:

1. Create a subscription product billed monthly at $3.99 USD. Copy its product id into `DODO_PAYMENTS_PRODUCT_ID`. Add a localized price for Germany of €3.99. The German app sends billing country `DE` and currency `EUR`, so that rule is what the customer pays. Without it, Dodo converts the $3.99 price at the exchange rate.
2. Create an API key under Developer → API Keys. Use a test key with `DODO_PAYMENTS_ENVIRONMENT=test_mode`, or a live key with `live_mode`.
3. Add a webhook endpoint under Developer → Webhooks. The URL is `https://<your-domain>/api/webhooks/dodo`. Copy the signing secret into `DODO_PAYMENTS_WEBHOOK_SECRET`.
4. Subscribe that endpoint to `subscription.active`, `subscription.renewed`, `subscription.on_hold`, `subscription.cancelled`, `subscription.failed`, `subscription.expired`, `subscription.updated`, `payment.succeeded`, `payment.failed`, `payment.processing`, and `payment.cancelled`.

`subscription.updated` keeps the period dates and the cancel-at-period-end flag in sync. Payment events are acknowledged and do not change the quota by themselves. The same webhook id is stored, so a retry does not apply twice.

Set the four `DODO_PAYMENTS_*` variables in Vercel before charging cards. With any of the key, product id, or environment missing, checkout and the portal return `BILLING_DISABLED` and the app still builds.

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm type-check
pnpm --filter @repo/database db:generate
pnpm --filter @repo/database db:migrate
```
