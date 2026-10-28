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

3. Create a Neon project. Put the pooled connection string in `DATABASE_URL` and the direct string in `DATABASE_URL_UNPOOLED`.

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

Magic-link emails are not sent. In development the link is printed in the server log. Google sign-in is registered only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set.

`extractRecipe` in `@repo/ai` calls AI Gateway with `AI_GATEWAY_MODEL`. It does not fetch a URL. Each ingredient includes `canonicalKey`, an English singular name used as the icon cache key.

## Icons

`packages/icons` draws one hero icon per recipe and one shared icon per ingredient. Ingredient icons are cached on `canonicalKey` after it is lowercased and hyphenated, so the same English key is reused across recipes. Generation is queued by `POST /api/icons/schedule` and continues in `after()`, so the import response does not wait. It does not write an `imports` row.

`GET /api/icons?recipeId=` returns status and URL. `RecipeIcons` polls that until every icon is `ready` or `failed`. The home page shows the empty clay placeholder.

Without `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`, generation writes a local WebP mock. Set `ICON_GENERATION_MODE=live` to require the gateway. The default image model is `google/gemini-3.1-flash-image-preview` (`AI_GATEWAY_IMAGE_MODEL`).

Icons go to S3 when `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_BUCKET` are set. Otherwise they are files under `.data/icons`, served at `/icons/{kind}/{file}`.

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm type-check
pnpm --filter @repo/database db:generate
pnpm --filter @repo/database db:migrate
```
