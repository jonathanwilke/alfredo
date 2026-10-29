# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated in the foundation brief, and built as specified: a pnpm + Turborepo monorepo, Next.js App Router in `apps/web`, Tailwind and shadcn-style components in `apps/web/modules/ui`, next-intl (`de` and `en`), Drizzle with Neon Postgres, better-auth (email magic link and Google), oRPC with an OpenAPI spec, and the Vercel AI SDK through AI Gateway. A native app is later, not this repo.

## Users

Home cooks. They read the screen from about 1–2 meters away, usually in the kitchen, with wet or floury hands and the phone or laptop on the counter.

## Product Purpose

ulivo turns a recipe URL into an ad-free, step-by-step cooking guide. Success is a cook who can follow one step at a time without leaving the app for a blog, a video, or an ad.

## Positioning

The guide is extracted from a link the cook already has, then translated into the language they chose. It is not a recipe search engine and not a blog.

## Operating Context

The cook pastes a link, checks servings and ingredients, then cooks one step per screen. A servings control rescales quantities. Cooking mode is fullscreen, with the ingredients for that step, timer buttons, and a wake lock. Accounts are optional.

## Capabilities and Constraints

Confirmed for the product, not all built in this foundation:

- Import from a recipe URL. AI extracts title, image, servings, prep and cook times, ingredients (quantity, unit, id), and steps (referenced ingredient ids, timers in seconds), translated into the chosen language.
- Recipe overview with a servings slider and checkable ingredients.
- Fullscreen cooking mode: one step per screen, per-step ingredients, timer buttons, wake lock.
- Optional accounts: email magic link and Google.
- Subscription via Dodo Payments: $2.99/month, 30 imports per billing period. The first recipe is free and needs an account. Quota events are `import` or `translation`. Icon generation does not count.

Recipe import, cooking mode, and optional accounts are built. Magic-link delivery is not connected. Billing calls Dodo Payments only when its env vars are set. The product id comes from `DODO_PAYMENTS_PRODUCT_ID`.

Locales now: German and English. The locale follows the browser language. German is the fallback.

## Brand Commitments

The name is ulivo. Binding visual constraints from the brief, recorded here and specified in DESIGN.md: warm cream background, olive and lime palette, Fraunces for headings, the supastarter UI component setup.

## Evidence on Hand

No customer quotes, press, or recipe corpus are in the repo. Do not invent them. The home page is a placeholder for the link input.

## Product Principles

- The cook is standing away from the screen. Type and controls stay large, especially in cooking mode.
- One step at a time. The guide does not compete with ads, popups, or a second task.
- The link the cook pasted is the source. Do not replace it with a catalog they did not ask for.
- Accounts and payment stay optional until the cook needs to save or import more than the free recipe.
- German and English are both first-class. Browser language wins.

## Accessibility & Inclusion

High contrast. Extra-large controls in cooking mode, sized for reading from 1–2 meters and for imprecise taps. Body and control text must stay readable against the cream and dark cooking surfaces.
