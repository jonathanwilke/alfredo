---
name: ulivo
description: Warm kitchen UI for turning a recipe link into a step-by-step guide.
colors:
  cream: "#F3EDE3"
  white: "#FFFFFF"
  ink: "#40442A"
  olive: "#6A7147"
  lime: "#D4E28D"
  body: "#5B5B5B"
  pale: "#F6F9E8"
  line: "#E4D9C8"
  cooking-bg: "#1A1D14"
  cooking-card: "#24281C"
  cooking-muted: "#C8C2B4"
  danger: "#8C2F24"
typography:
  display:
    fontFamily: "PT Serif, ui-serif, Georgia, serif"
    fontSize: "3.75rem"
    fontWeight: 500
    lineHeight: 1.05
  body:
    fontFamily: "Source Sans 3, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Source Sans 3, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  control: "9999px"
  icon: "1.75rem"
  md: "0.75rem"
spacing:
  page: "1.25rem"
  stack: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.pale}"
    rounded: "{rounded.control}"
    padding: "0 1rem"
    height: "2.5rem"
  button-primary-dark:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.cooking-bg}"
    rounded: "{rounded.control}"
    height: "4rem"
  input-link:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 1rem 0 2.5rem"
    height: "2.5rem"
  icon-tile:
    backgroundColor: "{colors.pale}"
    rounded: "{rounded.icon}"
---

# Design System: ulivo

## Overview

**Creative North Star: "A clay figure on the counter"**

ulivo is read from across a kitchen counter. The page is a warm cream field, type is large, and the one action is a pill-shaped link field. Icons are soft clay toys on the same cream, not photographs and not flat pictograms.

Components come from the supastarter setup: `tooling/tailwind/theme.css` holds the CSS variables, `@ui/lib` exposes `cn`, and `apps/web/modules/ui` holds Button, Input, and Label. Dark mode is the `dark` class from `next-themes`, and those tokens are the cooking-mode surface.

**Key Characteristics:**

- Cream ground, dark olive ink. White is for the link field, not a panel behind the form.
- Lime is the small accent, not the page background.
- PT Serif for headings, Source Sans 3 for everything else.
- The import field and its button are 2.5rem tall. Cooking-mode controls stay 4rem.
- One field, one button, sitting on the page.

## Colors

The palette is warm paper and olive, with lime used in small amounts.

### Primary

- **Dark olive ink** (#40442A): Headings, the primary button in light mode, and body emphasis.

### Secondary

- **Olive** (#6A7147): Secondary buttons and focus rings in light mode. Not for small text on cream (contrast is under 4.5:1).

### Tertiary

- **Lime** (#D4E28D): Accent chips, the pending icon blob, text selection, and the primary button in cooking mode.

### Neutral

- **Cream** (#F3EDE3): Page background.
- **White** (#FFFFFF): The link field.
- **Pale green** (#F6F9E8): Muted fills and primary-button text in light mode.
- **Body gray** (#5B5B5B): Secondary text on cream and white. Measured at 5.83:1 on cream.
- **Warm line** (#E4D9C8): Borders and input strokes.
- **Cooking night** (#1A1D14): Dark-mode background. Raised surfaces step up to #24281C. Body text becomes #C8C2B4.

### Named Rules

**The Distance Rule.** Cooking mode is read from 1–2 meters, so its controls stay 4rem. The import screen is a normal form: field and button are 2.5rem.

## Typography

**Display Font:** PT Serif (Georgia fallback), set with `next/font` as `--font-pt-serif`.

**Body Font:** Source Sans 3 (system sans fallback), weights 400 and 600, as `--font-source-sans`.

**Character:** PT Serif carries the heading. Source Sans 3 stays plain so a step is easy to read with wet hands.

### Hierarchy

- **Display** (500, 3.75rem–3.75rem scaling to 3.75/4.5rem, line-height 1.05): The page heading, `text-balance`, max about 22ch.
- **Body** (400, 1.125rem, line-height 1.6): The sentence under the heading. Measure stays under 48ch.
- **Label** (600, 1rem): Locale links. The wordmark is PT Serif at 1.875rem.

### Named Rules

**The Two Faces Rule.** Headings use PT Serif. UI text uses Source Sans 3. Do not add a third family.

## Layout

The home page is one column, `max-w-3xl`, left aligned. It centers vertically when the column fits the screen, and starts under the header when it does not, so a phone can scroll from the top. Page padding is 1.25rem, 2rem from the `sm` breakpoint. The heading is at most about 22 characters of PT Serif. The sentence under it is its own measure, under 48ch. The heading block and the import group are separated by 2rem. The icon and its caption sit together; the field sits 2rem below them, on the cream.

## Elevation & Depth

Depth is a soft shadow with a downward offset on the icon tile. The page itself stays flat. There is no glow and no panel behind the form.

### Shadow Vocabulary

- **Icon** (`box-shadow: 0 14px 28px -18px rgba(64, 68, 42, 0.7)`): An icon tile.

## Shapes

Buttons and the link input are pills. Icon tiles use 1.75rem. The shared `--radius` token stays 0.75rem so the supastarter `rounded-md` controls stay in family when a screen is not the import field.

## Components

### Buttons

- **Shape:** Pill on the import action. Default component radius is `rounded-md` from the supastarter button.
- **Primary:** Dark olive ink, pale text, height 2.5rem on the home screen. Cooking mode stays 4rem.
- **Hover / Focus:** Primary darkens with `hover:bg-primary/90`. Focus is a 2px ring in the olive (light) or lime (dark) token, offset from the background.
- **Cooking mode:** Primary flips to lime with dark text.

### Inputs / Fields

- **Style:** White pill, 2.5rem tall, link icon inset on the left, placeholder in body gray.
- **Focus:** 1px ring and border in the ring token.
- **Error:** `aria-invalid` and a destructive sentence under the field. Destructive is #8C2F24 on white.

### Icon tiles

- **Pending:** Pale green square, 1.75rem corners, a lime disc in the center, accessible name from the locale.
- **Ready:** The stored WebP fills the tile.
- **Failed:** The disc uses the destructive color at 30% opacity.

## Do's and Don'ts

### Do:

- **Do** keep the import field and its button at 2.5rem. Save 4rem controls for cooking mode.
- **Do** use cream (#F3EDE3) as the page background and white for the link field.
- **Do** set ingredient `canonicalKey` to an English singular name before asking for an icon.
- **Do** show the pending tile until an icon status is `ready`.

### Don't:

- **Don't** wrap the import flow, or a step, in a card. The field and the button sit on the page.
- **Don't** put small olive (#6A7147) text on cream or on lime.
- **Don't** use a third typeface, gradient text, or a glow shadow.
- **Don't** count icon generation as an import.
- **Don't** block the import response on image generation.
