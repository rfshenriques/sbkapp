# Design system

`apps/frontend` (player-facing) follows the design language from the owner's
BETGER prototype (7 static HTML mockups delivered directly in chat, not
committed to the repo: homepage, live event page, pre-match event page, bet
builder, bet slip, boosts, highlights). Every new player-facing page or
component, and every existing one that gets touched, should be built or
reskinned to match this system rather than left in the old plain-Tailwind
style. This is a standing instruction, not a one-time task.

**Don't hardcode BETGER's literal colors.** The system is brand-neutral:

- `apps/frontend/src/index.css` defines the token layer: fixed dark/light
  base palettes (background/surface/border/text, swapped via
  `[data-theme='light']`) plus three brand-driven colors that come from the
  `Brand` model, not from CSS: `--color-brand` (CTA/button color, used only
  by `.btn-primary`/`.btn-ghost` - Register, Place Bet, Browse matches, ...),
  `--color-highlight` (general accent - selected odds, kickoff times, status
  badges), and `--color-filter` (tabs/filter-chip active states, e.g. sport
  filters, sort tabs, the bet slip's Singles/Accumulator tabs). Keeping all
  three distinct is deliberate - a filter or a badge should never read as a
  button.
- `apps/frontend/src/features/brand/useBrandTheme.ts` fetches this
  deployment's own brand (`GET /public/brands/:id`, unauthenticated) and
  applies `themeMode`/`buttonColorHex`/`highlightColorHex`/`filterColorHex`
  as CSS custom properties + a `data-theme` attribute at runtime. Every
  brand created in the master backoffice should render correctly through
  this, unchanged.
- Shared primitives already exist for the recurring visual patterns: odds
  buttons (`.odd-btn`, `.selected`), primary/ghost CTAs (`.btn-primary`,
  `.btn-ghost`), filter/sort tabs (`.tab`, `.active`), the display font
  (`.font-display`, Poppins), and the tri-bar section marker
  (`.brand-flag`). Extend these rather than inventing parallel ones. Shape
  language is consistently rounded corners throughout, deliberately bigger
  and softer than a typical web app - an iOS-inspired scale rather than the
  earlier ~10px pass: buttons/tabs/pills ~12-14px (`.odd-btn`, `.btn-primary`,
  `.btn-ghost`, `.tab`, `.tab-pill`), cards ~16px (`Card`, sidebar panels,
  dropdown panels), the largest feature surfaces (hero card, match detail
  header, bottom-sheet top corners) ~24px, small status pills like
  LIVE/PRE-MATCH/bet-status fully rounded. There's no angular "slash" cut -
  it read as a rendering glitch on small badges rather than a deliberate cut.
- Hover/deep color variants are derived with `color-mix()` from each of the
  three brand colors individually - don't ask for or store a 4th color.

**Only build what's backed by real data.** The mockups assume a fully-built
multi-sport sportsbook (live scores/clock, per-sport tabs with counts,
boosted parlays, a highlights feed, bet builder with correlation pricing).
The actual data model today (`packages/shared`'s `Match`/`Market`/
`Selection`) is much smaller - no sport field, no live score, no boosts/
parlays/builder domain. When reskinning or building a page whose mockup
section has no backing data yet, match the visual system for what's real
and _omit_ the rest rather than fabricating placeholder data - add those
sections once the backend actually supports them. See `docs/PROJECT_BRIEF.md`
Section 10 for what's been reskinned so far and what's still pending.

**Verify visually, not just with tests.** Changes here are inherently visual

- after editing, run the app for real (Playwright + a real browser, per the
  `verify` skill) and look at a screenshot before calling it done. Prove brand
  theming actually works by checking at least two brands with different colors
  render distinctly, not just that the code compiles.
