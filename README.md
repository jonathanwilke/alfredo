# alfredo

alfredo turns a recipe URL into an ad-free, step-by-step cooking guide. This repo is the foundation: the monorepo, the web app shell, auth, the database draft, and the API. Importing a recipe, cooking mode, and billing are not built yet.

## Stack

- Turborepo and pnpm
- `apps/web`: Next.js App Router, Tailwind CSS, shadcn-style components in `modules/ui`, next-intl (`de`, `en`)
- `packages/database`: Drizzle ORM and Neon Postgres
- `packages/auth`: better-auth, email magic link and Google
- `packages/api`: oRPC, a typed client, and an OpenAPI document
- `packages/ai`: Vercel AI SDK through AI Gateway, plus the recipe schema

UI follows the supastarter Next.js setup: tokens in `tooling/tailwind/theme.css`, `cn` in `@ui/lib`, components in `apps/web/modules/ui`, and dark mode with `next-themes` (`class` on `html`). The palette is alfredo's: cream background, olive and lime, Fraunces headings, Source Sans 3 for body text.

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

| Path               | What it is                                                       |
| ------------------ | ---------------------------------------------------------------- |
| `POST /api/rpc`    | Typed oRPC endpoint used by `apps/web/modules/shared/lib/api.ts` |
| `GET /api/health`  | Health check                                                     |
| `GET /api/me`      | Current user, or `null`                                          |
| `GET /api/openapi` | OpenAPI document for a future Expo client                        |
| `/api/auth/*`      | better-auth (magic link and Google)                              |

Magic-link emails go out through Resend when `RESEND_API_KEY` is set. Without that key, development prints the link in the server log and production refuses to send. The sender is `ulivo <noreply@ulivo.app>` unless `EMAIL_FROM` is set. Google sign-in is registered only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set.

`extractRecipe` in `@repo/ai` calls AI Gateway. It uses `AI_GATEWAY_MODEL` when that is set, and `google/gemini-2.5-flash-lite` otherwise. It does not fetch a URL. Each ingredient includes `canonicalKey`, an English singular name used as the icon cache key.

## Icons

`packages/icons` draws one hero icon per recipe and one shared icon per ingredient. Ingredient icons are cached on `canonicalKey` after it is lowercased and hyphenated, so the same English key is reused across recipes. Generation is queued by `POST /api/icons/schedule` and continues in `after()`, so the import response does not wait. It does not write an `imports` row.

`GET /api/icons?recipeId=` returns status and URL. `RecipeIcons` polls that until every icon is `ready` or `failed`. The home page shows the empty clay placeholder.

Without `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`, generation writes a local WebP mock. Set `ICON_GENERATION_MODE=live` to require the gateway. The default image model is `google/gemini-3.1-flash-image-preview` (`AI_GATEWAY_IMAGE_MODEL`).

Icon files go to Neon Object Storage through a path-style S3 client. Required env vars are `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `S3_BUCKET`. `S3_PUBLIC_URL` is optional. With any of those required values empty, the upload is written under `.data/icons` and served at `/icons/{kind}/{file}`. Build and typecheck do not need the credentials.

## Environment

Every variable is listed in `.env.example`. None are required for `pnpm type-check` or `pnpm build`.

| Variable                 | Purpose                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`    | Public origin, default `http://localhost:3000`                         |
| `BETTER_AUTH_SECRET`     | Session secret, at least 32 characters                                 |
| `BETTER_AUTH_URL`        | Auth base URL, usually the same as the app origin                      |
| `DATABASE_URL`           | Neon pooled Postgres URL for the app                                   |
| `DATABASE_URL_UNPOOLED`  | Neon direct Postgres URL for Drizzle migrations                        |
| `GOOGLE_CLIENT_ID`       | Google OAuth client id. Both Google vars must be set together          |
| `GOOGLE_CLIENT_SECRET`   | Google OAuth client secret                                             |
| `RESEND_API_KEY`         | Resend key for magic-link email. Empty keeps the dev server log       |
| `EMAIL_FROM`             | Optional sender. Default `ulivo <noreply@ulivo.app>`                   |
| `AI_GATEWAY_API_KEY`     | Vercel AI Gateway key for local extraction and live icons              |
| `AI_GATEWAY_MODEL`       | Optional extraction model. Default `google/gemini-2.5-flash-lite`     |
| `AI_GATEWAY_IMAGE_MODEL` | Image model for icons. Default `google/gemini-3.1-flash-image-preview` |
| `ICON_GENERATION_MODE`   | `mock`, `live`, or empty (mock when no gateway credential is present)  |
| `VERCEL_OIDC_TOKEN`      | Gateway auth on Vercel. Injected there. Leave empty locally            |
| `AWS_ENDPOINT_URL_S3`    | Neon Object Storage endpoint for this branch                           |
| `AWS_ACCESS_KEY_ID`      | Neon storage access key id                                             |
| `AWS_SECRET_ACCESS_KEY`  | Neon storage secret                                                    |
| `AWS_REGION`             | Neon storage region, such as `us-east-2`                               |
| `S3_BUCKET`              | `public_read` bucket name for icon WebP files                          |
| `S3_PUBLIC_URL`          | Optional CDN origin. Empty uses `{endpoint}/{bucket}/{key}`            |

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm type-check
pnpm --filter @repo/database db:generate
pnpm --filter @repo/database db:migrate
```
