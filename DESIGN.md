# Heliarc design system

One source of truth for how Heliarc looks. Open `ui/design-system.html` to see every token and every component with all its states, in the light and the dark theme.

## Where things live

| File | What it is |
|---|---|
| `ui/tokens.css` | Colours (dark, and light), type scale, radii, shadows, motion. Spacing, type and shadows come from [Open Props](https://open-props.style). |
| `ui/components.css` | Button, field, select, checkbox, card, modal, toast, empty state (`ds-…` classes), each with hover, keyboard focus, disabled, loading and error states. |
| `ui/common.css` | Imports both, plus the base page style. Every screen loads it. |
| `scripts/ds-check.js` (`npm run ds:check`) | The guard: contrast of the colour tokens, and no hand-written colour or font size or radius in migrated screens. It also runs in the automatic tests. |

## Rules

1. **Colours, sizes, radii and shadows come from tokens.** Write `var(--panel)`, `var(--space-3)`, `var(--r-md)`, never `#1e1e24` or `10px`. A new value is a new token in `tokens.css`, added to both themes.
2. **Use a component before writing a style.** A button is `<button class="ds-btn primary">`, a field `<input class="ds-field">`. If it doesn't exist, add it to `components.css` and to the showcase page in the same change.
3. **Every interactive thing has all its states**: hover, keyboard focus (already visible on every component), disabled, loading (`is-loading` plus the `.spin`), error (`is-error` plus a `ds-hint`), and an empty state when it is a list.
4. **Light and dark.** A screen that supports both starts with `<html class="ds-auto">` and follows the system. Screens without it stay dark, as before.
5. **Text must stay readable**: the guard fails if a text token drops under 4.5:1 (3:1 for the accent used as an icon or outline) against its background, in either theme.
6. **When to use which**: `primary` for the one main action of a screen, default for the rest, `ghost` for quiet actions, `danger` for anything that destroys or weakens security (always next to a safe option). Modal only for a question that blocks the page; otherwise a card or a toast.

## Migration status

Every screen is on the design system and checked by the guard: `system.html`, `hung.html`, `design-system.html`, `cmdbar.html` (forced light theme: it is a light card), `panel.html`, `arc.html` (sidebar), `peek.html`, `find.html`, `little.html`, `newtab.html`, `auth.html`, `common.css`, `components.css`.

A new screen is added to `MIGRATED` in `scripts/ds-check.js` the day it is created. `node scripts/ds-check.js --inventory` lists the hand-written values left in any file.

What the migration folded together: about 23 slightly different whites and blacks in the sidebar became 4 white strengths (`--glass-0…3`), 2 text strengths (`--on-dim`, `--on-faint`), 3 black strengths (`--shade-0…2`) and the backdrop (`--scrim`); 9 font sizes became 7 (`--fs-xs … --fs-display`); 10 radii became 5 (`--r-xs`, `--r-sm`, `--r-md`, `--r-lg`, and `--r-view`, the rounding of the pages). The look is the same to the eye, slightly more even.

Not guarded yet: spacing (paddings and gaps are still written in px in the older screens) and the colours the app computes at run time (a space's gradient, a bang's brand colour, the Peek bar following the page).
