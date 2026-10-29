---
name: ulivo
description: Warm kitchen UI for turning a recipe link into a step-by-step guide.
colors:
  cream: "#F3EDE3"
  white: "#FFFFFF"
  ink: "#40442A"
  olive: "#6A7147"
  lime: "#C3D56D"
  body: "#5C584C"
  muted: "#6A655A"
  pale: "#F6F9E8"
  line: "#E4D9C8"
  input: "#D9CDB8"
  timer: "#DC6416"
  cooking-bg: "#1A1D14"
  cooking-card: "#24281C"
  cooking-body: "#E7E0D4"
  cooking-muted: "#C8C2B4"
  danger: "#8C2F24"
  wordmark: "#424C2B"
typography:
  display:
    fontFamily: "PT Serif, ui-serif, Georgia, serif"
    fontSize: "3.75rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
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
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 1.5rem"
    height: "3rem"
  button-cooking:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.cooking-bg}"
    rounded: "{rounded.control}"
    height: "4rem"
  button-outline:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "4rem"
  input-link:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 1.25rem 0 3rem"
    height: "3rem"
  icon-tile:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.ink}"
    rounded: "{rounded.icon}"
    size: "4rem"
---

# Design System: ulivo

## Overview

**Creative North Star: "A recipe card on the counter"**

ulivo is read on a warm cream page. The heading is a serif, the action is a lime pill, and the dish is a photographed plate. Ingredient pictures sit in bordered tiles on the same cream. Nothing about the import or a cooking step is wrapped in a card.

Tokens live in `tooling/tailwind/theme.css`. Body text is Inter (`--font-inter`). Headings are PT Serif (`--font-pt-serif`). Buttons stay on Inter. Dark mode is the `dark` class from `next-themes`; cooking mode uses that surface.

**Key Characteristics:**

- Cream ground, dark olive ink. White is the link field, not a panel behind the form.
- Lime (`#C3D56D`) is the action color: import, start cooking, and login. It is dark enough to read on cream.
- PT Serif for headings, Inter for body text and buttons.
- Import controls are 3rem. Cooking-mode controls stay 4rem and pinned to the bottom of the screen.
- Icon tiles have a warm border and no shadow. The dish photo keeps one soft shadow.

## Colors

The palette is warm paper and olive. Lime is the button, not the page.

### Primary

- **Dark olive ink** (`#40442A`): Headings, wordmark stroke family, and text on lime buttons in light mode.

### Secondary

- **Olive** (`#6A7147`): Focus rings in light mode. Not for small text on cream.

### Tertiary

- **Lime** (`#C3D56D`): Primary actions, text selection, the pending icon disc, and the primary button in dark mode. Darkened from `#D4E28D` so the pill separates from cream. Text on the button is ink in light mode and `#1A1D14` in dark mode.

### Neutral

- **Cream** (`#F3EDE3`): Page background.
- **White** (`#FFFFFF`): The link field and cards.
- **Pale green** (`#F6F9E8`): Muted fills behind icon tiles.
- **Body** (`#5C584C`): Regular text on cream. Warm, not gray.
- **Muted** (`#6A655A`): Secondary lines, such as an ingredient amount.
- **Warm line** (`#E4D9C8`): Borders, including icon tiles.
- **Input stroke** (`#D9CDB8`): Field borders.
- **Timer** (`#DC6416`): Countdown text. Dark mode uses `#F0943A`.
- **Cooking night** (`#1A1D14`): Dark background. Raised surfaces are `#24281C`. Body text is `#E7E0D4`. Secondary text is `#C8C2B4`.
- **Danger** (`#8C2F24`): Invalid fields.

### Named Rules

**The Lime Rule.** Lime is for the one action that should be taken. Save stays a ghost button. Back in a step is an outline button.

## Typography

**Display Font:** PT Serif (Georgia fallback), loaded with `next/font` as `--font-pt-serif`.

**Body Font:** Inter (system sans fallback), as `--font-inter`. Buttons use this face, `font-semibold`, not the heading face.

**Character:** PT Serif carries the title. Inter stays plain so a step and a form are easy to read.

### Hierarchy

- **Display** (600, 3.75rem, 4.5rem from `sm`, line-height 1.05, tight tracking): Page headings, `text-balance`, centered on the home page, full width on a recipe.
- **Body** (400, 1.125rem, relaxed leading): The sentence under a heading, also `text-balance` and centered on the home page.
- **Step** (400, 1.875rem, 2.25rem from `sm`): The cooking instruction.
- **Label** (600, 1rem): Amounts, times, and the wordmark lockup. The wordmark itself is 2.25rem tall.

### Named Rules

**The Two Faces Rule.** Headings use PT Serif. UI text and buttons use Inter. Do not add a third family.

## Layout

The home page is one column, `max-w-3xl`, at least the screen tall. The header stays at the top. Title, subtitle, and the import form are centered together in the space that remains. Page padding is 1.25rem, 2rem from `sm`.

A recipe overview is `max-w-5xl`. The title uses the full column. Start cooking comes before Save. The portion control sits under the dish photo. Ingredients are one column, two from `sm`, three from `lg`. Each ingredient puts the name on the first line and the amount plus form on a muted second line.

Cooking mode fills the viewport. The step text scrolls. Back and Next stay fixed at the bottom.

## Elevation & Depth

The page is flat. Inputs have no shadow. Icon tiles use a border in the warm line color instead of a drop shadow. The dish photograph is the one lifted surface.

### Shadow Vocabulary

- **Dish** (`box-shadow: 0 14px 28px -18px rgba(64, 68, 42, 0.7)`): The plated recipe photo only.

## Shapes

Buttons and the link input are pills. Icon tiles and the dish frame use 1.75rem corners. The shared `--radius` token stays 0.75rem for smaller controls.

The wordmark is an olive wordmark with a leaf, 2.25rem tall, ink around `#424C2B` with a `#3D4728` stroke.

## Components

### Buttons

- **Shape:** Pill.
- **Primary action:** Lime background, ink text, height 3rem, no shadow. Used for import, start cooking, and the login submit.
- **Hover / Focus:** `hover:bg-accent/90`. Focus is a 2px ring in olive (light) or lime (dark), offset from the background.
- **Cooking:** Next and Done are 4rem. Back is an outline button at the same height.
- **Save:** Ghost, with a bookmark icon. Saved state swaps in the checked bookmark.

### Inputs / Fields

- **Style:** White pill, 3rem tall, 1.125rem type, link icon inset on the left. No shadow.
- **Focus:** Border and ring in the ring token.
- **Error:** `aria-invalid` and a destructive sentence under the field.

### Icon tiles

- **Frame:** Pale fill, 1.75rem corners, 1px warm border, no shadow. Ingredient tiles are 4rem. The dish frame is 16:9.
- **Pending:** A lime disc in the center.
- **Ready:** The stored WebP fills the tile.
- **Failed:** The disc uses the destructive color at 30% opacity.

### Timer

- **In the step:** The duration stays as written. Starting it creates a floating lime-orange chip.
- **Floating:** Orange text on `timer` at 10% fill, a pill in the header. It flies from the words in the step to that spot. A second tap on the same duration wiggles the chip instead of starting another timer. Clicking the chip returns to that step.
- **Clock:** Under an hour, `m:ss`. At an hour or more, `hh:mm:ss`.

## Do's and Don'ts

### Do:

- **Do** use cream (`#F3EDE3`) as the page and lime (`#C3D56D`) for the main action.
- **Do** keep import controls at 3rem and cooking controls at 4rem.
- **Do** center the home title, subtitle, and form together.
- **Do** keep Back and Next visible while a long step scrolls.
- **Do** frame ingredient icons with `border-border` and leave the shadow on the dish photo.

### Don't:

- **Don't** wrap the import flow, or a cooking step, in a card.
- **Don't** put small olive (`#6A7147`) text on cream.
- **Don't** put a shadow on inputs or icon tiles.
- **Don't** use a third typeface, or set buttons in PT Serif.
- **Don't** turn the inline duration into a running clock. The countdown lives in the floating timer.
