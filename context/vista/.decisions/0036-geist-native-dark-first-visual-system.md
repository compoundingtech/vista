# Geist-native dark-first visual system

Status: accepted

Supersedes the default-theme and local-token assumptions in
[0033](./0033-default-to-os-color-scheme-via-light-dark.md). Refines
[0024](./0024-adopt-pierre-diffs-and-trees-as-wrapped-blocks.md) and
[0025](./0025-kit-is-a-genie-composed-workspace-package.md).

## Context

Vista started with kit-owned Tailwind v4 tokens (`--vista-*`) and an OS-following
default theme. That was enough to prove the render surface, Storybook coverage,
Mermaid context theming, and the `@pierre` diff/tree integration. The next phase
is no longer a proof of "can it render"; it is a product-quality review medium
that should feel native to the rest of our Vercel/Geist-style tooling.

The user chose the full Geist-native direction:

- Storybook and published Vista reviews default to dark.
- Vista has no separate brand accent; gray is the baseline and hue is semantic.
- Shell controls use Geist components, not locally styled raw React Aria controls.
- Statuses, badges, tables, and other common primitives use Geist components or
  Geist tokens where they fit.
- Visual quality is verified by screenshot critique against the Geist/Vercel
  reference target at each milestone.

## Decision

Vista adopts `@overeng/geist-design-system` as its visual system.

- **Dark-first default.** `dark` is the default theme for Storybook and published
  review shells. Light remains supported through the same explicit theme control,
  but the first-paint target and primary review experience are dark.
- **Geist components first.** Interactive and common UI primitives use Geist
  wrappers when available (`Button`, `Select`, `Badge`, `StatusDot`, `Table`,
  tabs/menus/inputs, etc.). Raw `react-aria-components` remain acceptable only
  where Geist has no wrapper or the Vista block is genuinely domain-specific.
- **Geist tokens, no Vista accent.** Vista block styling consumes Geist design
  tokens/classes and avoids a separate Vista brand palette. Color is reserved for
  semantic meaning: blue for primary/info, green for success/locked, amber for
  warning/open, red for error/awaiting or destructive state.
- **Semantic Vista blocks stay Vista blocks.** `ask`, `fork`, `decision-log`,
  `options-grid`, `system-explorer`, `diff`, `file-tree`, and other review blocks
  remain domain components. Geist supplies their primitives, density, typography,
  token system, and interaction polish; it does not flatten the review doctrine
  into generic cards.
- **Upstream gaps belong upstream.** If a reusable primitive in
  `@overeng/geist-design-system` diverges from the Vercel reference or is missing,
  the preferred fix is in the design system, not a one-off Vista override.
- **Visual critique is part of "done".** Each visual milestone is verified in
  Storybook with screenshots in `tmp/`, dark and light coverage, and critique
  against the Geist/Vercel reference target before commit/push.

## Consequences

- Vista's dependency composition includes `@overeng/geist-design-system` plus its
  peer/runtime needs, and the kit stylesheet imports the Geist foundation styles
  before its own Vista block layout rules.
- KR07 now means "Geist-native theming": `@pierre` Shiki themes, Mermaid, React
  Flow, and Shadow DOM integrations reconcile to Geist tokens rather than
  Vista-owned palette tokens.
- The older `light-dark()` OS-following default is no longer the default
  experience. It may remain useful as an implementation detail for light/dark
  token support, but `dark` is the product default.
- Storybook is not just a catalog; it is the regression and visual review surface
  for the redesign. Story organization should support growth in predefined block
  types while keeping review archetypes and block families semantically grouped.
- Domain-specific blocks may still need local CSS for layout and third-party
  integration seams, but those styles must use Geist tokens and follow Geist
  density, border, radius, typography, focus, and semantic-color rules.

## Greenfield amendment: complete StyleX migration

Geist remains the semantic visual system; StyleX is now its sole Vista-owned
styling realization. Every Vista-owned block and shell surface uses co-located
StyleX with Geist semantic tokens and explicit theme classes. Tailwind utilities,
the kit stylesheet, and Vista-owned component/global CSS are migration history,
not current contract. A third-party renderer whose foreign markup cannot receive
StyleX classes may retain one named, narrowly scoped stylesheet seam, still
token-aligned and covered in dark/light Storybook states.
