---
name: alfredo
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
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
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
  card: "1rem"
  icon: "1.75rem"
  md: "0.75rem"
spacing:
  page: "1.25rem"
  card: "1.5rem"
  stack: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.pale}"
    rounded: "{rounded.control}"
    padding: "0 2rem"
    height: "4rem"
  button-primary-dark:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.cooking-bg}"
    rounded: "{rounded.control}"
    height: "4rem"
  input-link:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 1.25rem 0 3.5rem"
    height: "4rem"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "1.5rem"
  icon-tile:
    backgroundColor: "{colors.pale}"
    rounded: "{rounded.icon}"
---

# Design System: alfredo

## Overview

**Creative North Star: "A clay figure on the counter"**

alfredo is read from across a kitchen counter. The page is a warm cream field, type is large, and the one action is a pill-shaped link field. Icons are soft clay toys on the same cream, not photographs and not flat pictograms.

Components come from the supastarter setup: `tooling/tailwind/theme.css` holds the CSS variables, `@ui/lib` exposes `cn`, and `apps/web/modules/ui` holds Button, Input, Card, and Label. Dark mode is the `dark` class from `next-themes`, and those tokens are the cooking-mode surface.

**Key Characteristics:**

- Cream ground, white cards, dark olive ink.
- Lime is the small accent, not the page background.
- Fraunces for headings, Source Sans 3 for everything else.
- Controls are at least 4rem tall on the import screen.
- One card, one field, one button.

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
- **White** (#FFFFFF): Cards and inputs.
- **Pale green** (#F6F9E8): Muted fills and primary-button text in light mode.
- **Body gray** (#5B5B5B): Secondary text on cream and white. Measured at 5.83:1 on cream.
- **Warm line** (#E4D9C8): Borders and input strokes.
- **Cooking night** (#1A1D14): Dark-mode background. Cards step up to #24281C. Body text becomes #C8C2B4.

### Named Rules

**The Distance Rule.** Body text and controls stay large enough to read from 1–2 meters. Cooking mode uses the dark tokens and does not shrink the controls.

## Typography

**Display Font:** Fraunces (Georgia fallback), set with `next/font` as `--font-fraunces`.

**Body Font:** Source Sans 3 (system sans fallback), weights 400 and 600, as `--font-source-sans`.

**Character:** Fraunces carries the heading. Source Sans 3 stays plain so a step is easy to read with wet hands.

### Hierarchy

- **Display** (500, 3.75rem–3.75rem scaling to 3.75/4.5rem, line-height 1.05): The page heading, `text-balance`, max about 22ch.
- **Body** (400, 1.125rem, line-height 1.6): The sentence under the heading. Measure stays under 48ch.
- **Label** (600, 1rem): Locale links and the wordmark.

### Named Rules

**The Two Faces Rule.** Headings use Fraunces. UI text uses Source Sans 3. Do not add a third family.

## Layout

The home page is one column, `max-w-3xl`, left aligned, with the content vertically centered. Page padding is 1.25rem, 2rem from the `sm` breakpoint. The heading block and the card are separated by 2rem.

## Elevation & Depth

Depth is a soft shadow with a downward offset, plus a white card on cream. There is no glow.

### Shadow Vocabulary

- **Card** (`box-shadow: 0 16px 40px -28px rgba(64, 68, 42, 0.55)`): The link card at rest.
- **Icon** (`box-shadow: 0 14px 28px -18px rgba(64, 68, 42, 0.7)`): An icon tile.

## Shapes

Buttons and the link input are pills. Cards use `rounded-2xl` (1rem). Icon tiles use 1.75rem. The shared `--radius` token stays 0.75rem so the supastarter `rounded-md` controls stay in family when a screen is not the import field.

## Components

### Buttons

- **Shape:** Pill on the import action. Default component radius is `rounded-md` from the supastarter button.
- **Primary:** Dark olive ink, pale text, height 4rem on the home screen.
- **Hover / Focus:** Primary darkens with `hover:bg-primary/90`. Focus is a 2px ring in the olive (light) or lime (dark) token, offset from the background.
- **Cooking mode:** Primary flips to lime with dark text.

### Cards / Containers

- **Corner Style:** 1rem.
- **Background:** White in light mode, #24281C in cooking mode.
- **Shadow Strategy:** The card shadow above.
- **Border:** Warm line.
- **Internal Padding:** 1rem, 1.5rem from `sm`.

### Inputs / Fields

- **Style:** White pill, 4rem tall, link icon inset on the left, placeholder in body gray.
- **Focus:** 1px ring and border in the ring token.
- **Error:** `aria-invalid` and a destructive sentence under the field. Destructive is #8C2F24 on white.

### Icon tiles

- **Pending:** Pale green square, 1.75rem corners, a lime disc in the center, accessible name from the locale.
- **Ready:** The stored WebP fills the tile.
- **Failed:** The disc uses the destructive color at 30% opacity.

## Do's and Don'ts

### Do:

- **Do** keep the import field and its button at least 4rem tall.
- **Do** use cream (#F3EDE3) as the page background and white for cards.
- **Do** set ingredient `canonicalKey` to an English singular name before asking for an icon.
- **Do** show the pending tile until an icon status is `ready`.

### Don't:

- **Don't** put small olive (#6A7147) text on cream or on lime.
- **Don't** use a third typeface, gradient text, or a glow shadow.
- **Don't** count icon generation as an import.
- **Don't** block the import response on image generation.
