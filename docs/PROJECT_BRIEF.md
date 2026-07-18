# Project Brief: Sportsbook Platform — For Claude Code

## How to use this document

This is the full context for a from-scratch sportsbook platform build. It is
meant to be dropped into the project as `docs/PROJECT_BRIEF.md` (or pasted
at the start of a Claude Code session) so there's no ambiguity about scope,
architecture, or working method. The owner has a deep professional
background in sportsbook operations (trading, risk, CRM, etc.) — treat
domain requirements below as authoritative business requirements, not
suggestions to second-guess. Technical architecture decisions are open to
discussion and improvement; business/domain requirements are not.

This is a **living document**. As modules get built, detailed
per-module specs should be added under `docs/modules/<module-name>.md`,
and this brief updated if architecture decisions change.

---

## 1. How We Work On This Project

These working principles matter as much as any technical decision below:

- **Slow, incremental, one piece at a time.** Do not scaffold large swaths
  of functionality in one shot. Build a thin slice, test it, confirm it
  works, then move to the next piece.
- **Always test.** Every module needs working tests before being considered
  done. The goal is to never have to come back and re-verify something that
  was supposedly finished.
- **Code must stay easy to understand and easy to change.** This project
  will evolve — new requirements will surface mid-build. Prioritize clear
  naming, small well-scoped files, and strict module boundaries (see
  Section 4) over cleverness or premature optimization.
- **Organize strictly by section/module.** Anyone (including a future
  Claude Code session with no memory of this one) should be able to open
  one module's folder and understand and modify it without needing to
  understand the rest of the system.
- **Surface ambiguity instead of guessing.** If a requirement is unclear or
  a decision has business implications (e.g., a risk threshold, a
  liability rule), ask rather than assume — the owner has the domain
  expertise to answer precisely.
- **Document decisions as they're made**, especially anything that
  deviates from this brief.

---

## 2. Product Vision

- A sportsbook platform that **feels instant** — near-zero perceived
  latency, no full-page reloads, near-instant touch response, predictive
  pre-loading of likely next screens.
- Runs from **one codebase** across all browsers, iPhone, and Android, with
  Smart TVs and a simple smartwatch companion as later phases.
- **Signature future feature**: Smart TV second-screen betting — detect
  the live match being broadcast on TV, match it to the corresponding live
  betting market, let the user log in via QR code, and bet from a side
  panel on the TV while watching. (R&D track, not a launch blocker.)
- Every operational domain — trading/odds, content, promotions, freebets,
  bonuses, risk, marketing, CRM, design, fraud, KYC/AML, PAM — must be
  manageable from an internal backoffice, not outsourced to third-party
  admin tools (only regulated pieces like KYC/AML verification, payment
  processing, and the odds data feed itself are external integrations).

---

## 3. Platform Strategy

**Decision: Progressive Web App (PWA) first, not React Native.**

- Single React + TypeScript codebase, installable on iOS/Android home
  screens without an app store.
- Works identically across Safari, Chrome, Firefox, etc.
- Can be wrapped later (e.g., via Capacitor) for app-store distribution
  without a rewrite, if ever needed.
- **Smart TV**: Samsung Tizen and LG webOS run web apps as their native app
  runtime; Android TV can host the same app in a WebView — so the TV
  betting feature reuses the same frontend codebase with a TV-specific
  layout/input mode, not a separate app.
- **Smartwatch**: deferred, later phase — realistically a thin native
  companion (WearOS/watchOS) for notifications and one-tap bet
  confirmation only, not a full UI.
- The "instant, predictive" feel is achieved through concrete engineering,
  not a special technology:
  - Route-level code-splitting (only load what's needed for the current
    screen).
  - Prefetch-on-touchstart/hover for likely next screens (e.g., pre-fetch
    match detail as soon as a match card scrolls into view).
  - WebSocket-pushed odds/market diffs — never polling.
  - Optimistic UI on bet slip actions, reconciled against the server
    response.
  - Skeleton screens instead of spinners; app shell cached via service
    worker.

---

## 4. System Architecture

**Decision: Modular monolith for the backend, with the odds/trading engine
split out as its own real-time service from day one.**

**Why not full microservices immediately:** full microservices before a
working product exists means solving service discovery, distributed
transactions, and cross-service observability before a single bet has ever
been placed. Given the "slow, step by step, testable, easy to update one
section" working style, a modular monolith gets the same practical benefit
(independent, swappable sections) without that upfront operational cost.

**Rules that keep future extraction into real microservices painless:**
- Every domain module owns its own folder, its own DB schema/namespace,
  and its own DTOs.
- Modules **never** query another module's tables directly — only through
  a defined internal service interface or event.
- All cross-module communication goes through an **internal event bus**
  (in-process to start, swappable later for Redis/NATS/Kafka without
  changing module code) — so if/when a module needs to become its own
  microservice, it already communicates like one.

**Exception — Odds/Trading Engine is a separate service from day one**,
because it has a fundamentally different performance profile: constant
streaming price updates, fan-out to many concurrently-open connections,
low-latency requirements. It publishes odds/market events onto the bus;
every other module subscribes as needed.

```
                    ┌─────────────────────┐
                    │   Odds / Trading      │  ← own service, own scaling
                    │   Engine (real-time)  │
                    └──────────┬───────────┘
                               │ events (odds updates, market state)
                    ┌──────────▼───────────┐
                    │   Internal Event Bus   │
                    └──────────┬───────────┘
   ┌────────────┬──────────────┼──────────────┬────────────┐
┌──▼───┐    ┌────▼───┐    ┌─────▼────┐   ┌─────▼────┐  ┌────▼────┐
│ Auth/ │    │ Wallet/│    │ Promotions│   │  Risk    │  │  CRM /  │
│ KYC   │    │ Ledger │    │ Bonus/    │   │  Engine  │  │Marketing│
│       │    │        │    │ Freebets  │   │          │  │         │
└───────┘    └────────┘    └──────────┘   └──────────┘  └─────────┘
        (all modules of ONE backend codebase — modular monolith)
                               │
                    ┌──────────▼───────────┐
                    │   Admin Panel / CMS    │
                    └───────────────────────┘
```

---

## 5. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite, built as a PWA | Fast dev loop, huge ecosystem, one codebase for web/mobile/TV |
| Styling | Tailwind CSS | Fast iteration, consistent design tokens |
| Client state | Zustand + TanStack Query | Local UI state separate from server cache; strong optimistic-update support |
| Realtime transport | WebSockets (Socket.IO or native `ws`) | Push odds/bet-slip updates instantly; no polling |
| Backend | Node.js + TypeScript, NestJS | NestJS's module system maps directly onto "modular monolith with clean boundaries"; same language as frontend, one team can work across the stack |
| Odds/Trading Engine | Node.js to start; Go as fallback | Start in Node for development speed; revisit in Go only if real load demands raw throughput |
| Primary database | PostgreSQL | Transactional integrity for wallet/ledger/bets — non-negotiable anywhere money moves |
| Cache / session / pub-sub | Redis | Session store, hot odds cache, internal event bus transport |
| Analytics / time-series | ClickHouse or TimescaleDB (add later) | Odds history, trading analytics, CRM behavioral data — introduce once real volume justifies it |
| Infrastructure | Docker Compose locally → Kubernetes later | Every module runs in its own container from day one, even inside the monolith repo, so extracting a module later is "give it its own deployment," not a rewrite |
| CI | GitHub Actions | Test-on-every-commit, matching the "always testing everything" working principle |

**Third-party/regulated systems to integrate, not build in-house:**
- Odds/sports data feed provider (e.g., Betradar, Genius Sports, or similar)
- KYC/AML verification provider (e.g., Sumsub, Onfido, Trulioo) — deferred
  per owner's instruction, but architecture should leave a clean
  integration point
- Payment processing / payment fraud tooling
- Gambling license & regulatory compliance (jurisdiction-dependent)

---

## 6. Repo Structure (monorepo)

```
sportsbook/
├── apps/
│   ├── frontend/              # React PWA (web, mobile, TV shell)
│   ├── backend/                # NestJS modular monolith
│   │   └── src/modules/
│   │       ├── auth/
│   │       ├── kyc/
│   │       ├── pam/                  # Player Account Management (the hub)
│   │       ├── wallet-payments/
│   │       ├── promotions-bonus/     # bonus/promotions/freebets
│   │       ├── risk/
│   │       ├── fraud/
│   │       ├── crm/
│   │       ├── marketing/
│   │       ├── cms/
│   │       ├── design-backoffice/
│   │       ├── notifications/        # cross-cutting dispatcher, see §9
│   │       └── admin/                # roles/permissions, audit log
│   └── odds-engine/            # separate real-time service
├── packages/
│   └── shared/                  # shared TS types/DTOs used by frontend + backend
├── infra/
│   ├── docker/
│   └── migrations/
└── docs/
    ├── PROJECT_BRIEF.md         # this file
    └── modules/                 # one detailed requirements doc per module, written just before each is built
```

---

## 7. Build Order (Phase Plan)

**Phase 0 — Foundations** (before any feature code)
- Repo scaffolding, linting/formatting, TypeScript strict mode, CI pipeline.
- Docker Compose for local dev (Postgres, Redis, backend, frontend, odds
  engine stub).
- Shared types package wired between frontend and backend.
- Internal event bus skeleton (even if in-process only for now), with the
  cross-module events from Section 9 stubbed out.

**Phase 1 — Frontend shell + design system** (against mock data)
- Design tokens, component library, layout/navigation shell.
- Route-level code-splitting, service worker, prefetch-on-touch behavior.
- Mock odds board + mock bet slip to validate the "instant feel" UX before
  any real backend exists.

**Phase 2 — API contract**
- Define the real shape of odds, markets, bets, and accounts (OpenAPI or
  shared TypeScript types). Lock this before backend implementation so
  nothing gets built twice.

**Phase 3 — First vertical slice, real backend**
- Basic auth, a mock/paper odds feed running through the real odds-engine
  service, bet placement with paper money, wired end-to-end to Postgres.
- Goal: one real bet, placed by a logged-in user, on a live-updating odds
  board, working start to finish — proving the whole pipeline before
  building anything on top of it.

**Phase 4 — Replace mocks, tune performance**
- Swap frontend mock data for the real API/WebSocket feed.
- Measure and tune time-to-first-odds, WebSocket round-trip latency, and
  optimistic bet-slip reconciliation.

**Phase 5 — Expand module by module**
For each remaining module (PAM, Wallet/Payments, Promotions/Bonus/
Freebets, Risk, Fraud, CRM, Marketing, CMS, Design backoffice,
Notifications, Admin/roles): same pattern every time — write the detailed
requirements doc in `docs/modules/` → define its contract/events → build
the backend module → wire the frontend → test → done. This is where the
owner's sportsbook-management expertise drives the actual business rules.

**Later / R&D track** (explicitly not blocking core build)
- Smart TV live-match detection and second-screen QR login/bet flow.
- Smartwatch companion app.
- Streaming integration (format TBD).

---

## 8. Feature Inventory by Module

> Level-one detail only — enough to shape schemas and events for Phase 0.
> Full field-level requirements are written module-by-module in Phase 5,
> right before each module is built.

### 8.1 Risk
- Pattern analysis across markets, events, selections, competitions,
  sports, and **between users/user groups** — not just single-account
  analysis.
- Opening price vs. closing price (SP/CP) movement tracking.
- Turnover-spike detection per market/event/selection/competition/sport,
  measured against configurable thresholds.
- **Auto-lock** of an individual market/game/selection — independently for
  prematch and in-play — the moment a threshold is breached.
- Backoffice alert accompanying every auto-lock: what triggered it, and
  which users were involved.
- Weekly/monthly grouped analysis identifying user groups exploiting the
  same events/markets repeatedly — how often, and where.
- Sport-specific triggers: red cards, penalties.
- Heatmap-style exposure view across markets/events.
- Arbitrage-pattern alerts.
- Alerts for betting patterns with non-round stakes (a classic
  bot/syndicate signal).

### 8.2 Fraud
- Device fingerprinting, cross-checked between accounts.
- Duplicate payment methods across accounts.
- Duplicate IPs across accounts; multiple logins from the same
  location/device.
- Chargeback tracking.
- Spike detection on operations/transactions, grouped by device, IP,
  location, or payment method.
- Pattern detection across linked groups of users, not only individuals.
- (Shared logic with Risk's multiple-account detection — see §9.)

### 8.3 CRM
- Full segmentation engine across financial, behavioral, betting,
  personal, location, and IP data — any combination, any field the
  operation has.
- Retention, reactivation, acquisition, and affiliation tracking, with
  alerts when any of those metrics drop.
- Campaign builder: trigger campaigns off arbitrary IF-conditions across
  odds, markets, matches, deposits, withdrawals, and login
  platform/device (desktop/mobile/iOS/Android).
- Per-campaign performance analysis.
- **Player-level CRM campaigns always take priority** over general,
  non-segmented Bonus-module campaigns (see §9 for the enforcement point).

### 8.4 Trading / Odds
- Trading cockpit for manual price changes.
- Boosted selections, with or without max stake / max liability caps.
- Liability limits configurable per market, event, competition, selection,
  tier-of-event, or sport — same granularity for odds margin.
- **Dynamic margin** by outcome probability within a market (e.g., player
  props: low margin on favorites, higher margin on longshots, to keep
  prices competitive) — also applies to outrights.
- Odds boost **tokens** targeted at specific individual players only.
- Ability to move prices up or down for a defined player group only.
- Time-to-kickoff-based liability/odds limits, to protect the book while a
  market is still "immature."
- Settlement backoffice: automatic settlement driven by match results and
  predefined rules, plus manual settlement/override when needed.

### 8.5 PAM (Player Account Management)
- The account "spine": registration, personal data, transactional/
  financial history, betting history, CRM data, segmentation membership,
  account status, flags, and customer-support history. Nearly every other
  module reads from and writes flags/notes into PAM.

### 8.6 Content / CMS
- Deeply integrated with PAM, CRM, and Risk — what a given player sees
  (or doesn't) is personalized live off their activity, segmentation,
  history, flags, risk status, active campaigns, and financial data.
- Banners and event/market/selection cards placeable anywhere in the app,
  manually or automatically, contextual to event/competition/sport pages.

### 8.7 Design
- Standalone backoffice purely for visual design, applied automatically
  across target platform sizes/breakpoints — keeps visual output
  consistent without per-platform code changes.

### 8.8 Marketing
- Supports CRM on acquisition campaigns.
- Affiliate tooling: codes, tracking links, and performance analysis that
  separates organic traffic from affiliate-driven traffic.

### 8.9 Bonus / Promotions / Freebets
- Two wallets per player: **cash wallet** and **bonus wallet**.
- Freebets as a bonus-wallet instrument, with configurable wagering
  requirements, conditions, and split/no-split behavior.
- Owns the **general, non-segmented (or lightly segmented)** campaigns —
  acca insurance, acca boost, general bet-e-gets — as distinct from CRM,
  which owns segmented campaigns.
- Still linked to PAM/CRM for player-level exceptions and analysis.
- Explicit priority rule: **CRM player-level campaigns always override
  general Bonus-module campaigns** when both could apply.
- Tournament leaderboards with automatic scoring from settled bets against
  defined criteria.

### 8.10 Player-Facing Tools/Features
- **Progressive/partial cashout**: offer scales down as open legs
  increase; partial cashout lets a player cash out on some legs while the
  rest ride at a reduced potential payout.
- **Acca insurance**: opt-in on the bet slip — reduced payout if the acca
  wins, a scaled refund (up to a defined amount, based on number of
  losing legs) if it loses.
- **Acca boost**: extra percentage boost per leg once the acca is above a
  minimum odds threshold.
- **Bet builder / same-game parlay**: build correlated same-match bets;
  supports pre-built backoffice-configured bet builders with their own
  boosts; supports outright bet builders for select competitions;
  supports **player-requested custom bets** where trading manually prices
  a specific combination on request.
- Streaming — deferred, to be defined later.
- **Competition focus hubs**: re-theme the whole app around a major
  tournament (Euros, World Cup, Copa América) with tournament-only
  content.
- **Community trending accas / bet builders**: surface the most-repeated
  player-built accas and bet builders on the homepage.
- **Badges / progression bars**: social-proof indicators showing how
  other bettors are leaning on a market, and campaign progress bars.

---

## 9. Cross-Module Dependencies & Events

This section drives what needs to exist on the internal event bus from
Phase 0 — retrofitting these later is exactly the rework this project is
trying to avoid.

- **PAM is the hub.** Nearly every module reads from it (segmentation,
  flags, status) and writes to it (flags, notes, status changes). Treat
  PAM's data model as close to core schema, even though it remains its own
  module.
- **Risk → Trading**: an auto-lock decision must immediately lock the
  specific market/selection, prematch or in-play. This needs to behave
  synchronously — a delay here is a real liability exposure, not just a
  UX issue.
- **Risk → Backoffice/Admin**: every auto-lock produces an alert with full
  context (which users, which thresholds, why).
- **Risk ↔ Fraud**: multiple-account detection and cross-user pattern
  analysis are needed by both — this logic (or its output) should be
  shared, not duplicated in two places.
- **Fraud → PAM**: fraud flags land on the player's PAM record and must be
  visible to Risk, CRM, and Bonus (e.g., to block bonus abuse).
- **CRM → Content/CMS**: segment membership drives what content a player
  sees; CMS needs to query CRM segments (or subscribe to segment-change
  events) in real or near-real time.
- **CRM ↔ Bonus/Promotions**: the "CRM overrides general Bonus campaigns"
  priority rule needs to be enforced in one shared place (e.g., PAM or a
  shared "active offers" resolver) — not duplicated independently in both
  modules.
- **Trading (settlement) → Wallet/PAM**: settled bets pay into the correct
  wallet (cash or bonus) and update PAM's betting history.
- **Notifications are cross-cutting**, not owned by any single module —
  CRM, Risk, Fraud, and Bonus all need to trigger emails/push/SMS/in-app
  messages. Build one internal "notification dispatcher" module that
  everything else calls into, rather than each module building its own.

---

## 10. Open Items / Decisions Still Needed

- **Responsible Gambling (RG)**: deposit/loss/wager limits, self-exclusion,
  reality checks, cooling-off periods. KYC/AML was deferred by the owner,
  but RG is typically a legal requirement in most licensed jurisdictions —
  needs a decision on jurisdiction(s) targeted, and at minimum schema
  space reserved even if not built yet.
- **Payments/Cashier module**: deposits, withdrawals, payment provider
  integrations, currency handling — implied throughout (Wallet, Fraud
  chargebacks, Bonus cash/bonus wallets) but not yet defined as its own
  module. `User.balanceCents` (see Bet placement below) is paper money
  only — a plain integer field, no currency, no deposit/withdrawal path,
  no real payments provider. Real money will likely want its own Wallet
  model (possibly multiple: real vs. bonus balance) rather than reusing
  this field directly.
- ~~Backoffice staff auth + roles~~ **Auth + basic roles done**
  (`apps/backend/src/modules/admin/`) - a wholly separate identity system
  from player auth (own `StaffUser` table, own JWT secret so tokens can't
  cross over even by accident), with a `StaffRole` enum (ADMIN/TRADING/
  RISK/CRM/FRAUD/CMS) and a `@Roles()` guard. This now gates bet
  settlement (only ADMIN/TRADING can settle). The admin-key stopgap is now
  a true one-time bootstrap only: `POST /admin/staff-users/bootstrap`
  (`StaffBootstrapController`) works exactly once, while it is the only
  staff account in existence - `StaffAuthService.bootstrapStaffUser`
  throws `ForbiddenException` the moment any `StaffUser` row exists. From
  there on, staff accounts are created by an authenticated ADMIN via
  `GET/POST /admin/staff-users` (`StaffUsersController`, gated by
  `StaffJwtAuthGuard` + `RolesGuard('ADMIN')`) - no shared key needed.
  What's still open:
  - ~~No audit log~~ **Audit log done** - `AuditLogEntry` (append-only,
    no FK to `StaffUser` so entries outlive a deleted staff account) is
    written for `STAFF_USER_BOOTSTRAPPED`, `STAFF_USER_CREATED`, and
    `SELECTION_SETTLED` (with before/after status in `metadata`), the
    settlement entry written atomically inside the same Prisma
    transaction as the settlement itself. `GET /admin/audit-log`
    (`AuditLogController`, ADMIN only) backs a new "Audit log" screen in
    `apps/backoffice/`. Not yet covered: staff logins, refresh-token
    activity, or any action outside these three - extend
    `AuditLogService.record()` call sites as more staff actions are
    added.
  - ~~No backoffice UI~~ **Settlement + market suspension + staff-user
    management + audit log UI done** (`apps/backoffice/`) - a separate
    Vite+React staff app (port 5174 dev / distinct Docker service, also
    proxies `/api` to the odds-engine now) with its own login page and:
    - a settlement screen (filter bets by status, settle a selection
      OPEN/WON/LOST/VOID with one click) - ADMIN/TRADING;
    - a markets screen: browse live matches from the odds-engine,
      expand one to see its markets, and suspend/unsuspend a whole match
      or one specific market - ADMIN/TRADING;
    - a staff-users screen (list existing staff, add a new one) - ADMIN
      only;
    - an audit-log screen (time/actor/action/target/details) - ADMIN
      only.

    Role gating uses a general `RequireRoles(roles)` route/nav guard
    (superseded the earlier ADMIN-only `RequireAdminRole`), backed by the
    server's own `RolesGuard` so the restriction isn't just cosmetic.
    Reuses the same JWT-in-memory + httpOnly-refresh-cookie pattern as
    the player app. Verified with real Postgres end-to-end through a
    real browser (Playwright): bootstrapping the first ADMIN, settling a
    bet and confirming the player's wallet was actually credited,
    creating a new staff user through the form and confirming they can
    really log in, confirming a non-ADMIN/non-TRADING sees the
    client-side block *and* gets a 403 from the backend independently on
    every gated screen, and confirming settlement/staff-creation/market
    actions all show up correctly attributed on the audit-log screen.
    Market suspension's *blocking* behavior (`PamService.placeBet`
    rejects a suspended match/market) was verified via real HTTP calls
    against the real backend; the live-match-browsing half of that
    screen could only be verified against its unit tests (mocked fetch)
    in this dev sandbox, because outbound access to `api.odds-api.io` is
    blocked by the sandbox's own egress policy (confirmed via the proxy
    status endpoint - a policy denial, not a data-source problem) -
    worth a real check next time this runs somewhere with that host
    allowed. Other backoffice functions (player/user admin, KYC/fraud
    review, etc.) aren't built yet.
  - **Roles are coarse** - one enum value per staff member, no
    fine-grained permissions within a role (e.g. TRADING can settle any
    bet, no per-market/per-sport scoping).
  - **Market suspension has no expiry/auto-clear** - a suspended
    match/market stays suspended until a staff member manually
    unsuspends it, even after the match finishes. No cron/cleanup job
    exists yet.
- ~~Reporting / BI~~ **First slice done**: `ReportsService`
  (`apps/backend/src/modules/reports/`) is exactly the "read-layer over
  other modules' data" this section originally called for - it queries
  `Bet`/`BetSelection` and `AuditLogEntry` directly rather than owning
  any data of its own. `GET /admin/reports/summary` (bet counts by
  status, total/settled stake, settled payout, and a **settled-only**
  GGR = settled stake − settled payout, both filterable by an optional
  `from`/`to` date range) and `GET /admin/reports/staff-activity`
  (selections settled per staff member, sourced from the audit log) back
  a new "Reports" screen in `apps/backoffice/`, ADMIN only. Verified with
  real Postgres + a real browser: placing and settling real bets through
  the actual settlement UI, then confirming the Reports screen's numbers
  match by hand (stake/payout/GGR math, and the settling ADMIN's
  activity count). Still open, deliberately not attempted because the
  data model has nothing to compute them from yet: **NGR** (no
  bonus/promo system exists to net out - NGR ≈ GGR for now), **campaign
  ROI** (no marketing/campaign data exists at all), and any **time-series
  / chart view** (the screen is summary-cards + tables only, matching the
  rest of the backoffice's table-first UI - no charting library pulled
  in for a single screen).
- **KYC/AML**: explicitly deferred by the owner — architecture should
  leave a clean integration seam (e.g., a `kyc` module boundary already
  exists in the repo structure) without building the logic yet.
- **Multi-brand / white-label platform**: the owner's actual end goal -
  run many sportsbook brands worldwide off one product, each with its own
  domain, logo, button/highlight colors, and enabled-product set (cashout
  Y/N, bet builder Y/N, more products later), managed from a single
  master backoffice the owner alone can log into, with each brand's
  existing per-brand backoffice (`apps/backoffice/`) continuing to
  control/analyze just that one brand. Three architectural decisions were
  made explicitly (not guessed) before writing any code: **(1)** data
  isolation is a shared Postgres DB with a `brandId` column on every
  table, not a DB/schema per brand; **(2)** the master backoffice is its
  own separate app with its own single-owner auth, not a role bolted
  onto the existing `StaffUser` system; **(3)** the first piece is
  additive-only - the `Brand` model and master CRUD - with the
  `brandId` retrofit onto existing tables as an explicit next piece.
  Both pieces are now done:

  **Piece 1 - Brand model + master CRUD:**
  - `MasterUser`/`MasterRefreshToken` (`apps/backend/src/modules/master/`)
    - a third wholly separate identity system alongside player auth and
    staff auth, own `MASTER_JWT_SECRET`, same one-time-bootstrap-then-403
    pattern as staff auth's `AdminKeyGuard`/`StaffBootstrapController`
    (`MasterKeyGuard` + `POST /master/auth/bootstrap`, gated by
    `MASTER_ADMIN_KEY`, works exactly once).
  - `Brand` + `BrandProductFlag` - `name`, unique `slug`, unique
    `domain`, `logoUrl`, `themeMode` (`LIGHT`/`DARK`, defaults `DARK`),
    `buttonColorHex`, `highlightColorHex`; products are a free-text key
    validated against `KNOWN_PRODUCTS` (currently `CASHOUT`,
    `BET_BUILDER`) rather than a DB enum, so adding a new product later
    doesn't need a migration. Per the owner: brand setup is deliberately
    just "appearance (light/dark) + 2 colors (button, highlight)" - the
    background/surface palette itself is *not* per-brand configurable,
    it's derived from `themeMode` on the frontend side, so there's no
    third color field to keep readable against arbitrary backgrounds.
  - New `apps/master-backoffice/` app (port 5175 dev), structurally a
    clone of `apps/backoffice/`'s proven shape: a login page, a brands
    list with an inline create form, and a brand detail page for editing
    theme fields and toggling product flags.

  **Piece 2 - `brandId` retrofit:** every player, staff account, bet,
  audit entry, and market suspension now belongs to exactly one brand.
  - Schema: `brandId` (required FK to `Brand`) added to `User`,
    `StaffUser`, `Bet` (denormalized from `user.brandId` at bet-creation
    time so listing/reporting queries don't need a join), `AuditLogEntry`,
    and `MarketSuspension` (whose unique constraint became
    `[brandId, matchId, marketId]` - the same externally-sourced matchId
    is shared across all brands via one global odds feed, but suspending
    it is each brand's own independent trading decision). Applied as a
    single migration adding the columns as NOT NULL directly (no
    nullable-then-backfill dance) since every environment this runs
    against - local dev, CI's ephemeral Postgres - starts with empty
    tables; the migration also seeds one deterministic "Default Brand"
    (fixed id `00000000-0000-0000-0000-000000000001`) so dev/CI don't
    need a manual bootstrap step to keep working.
  - **Kept `User.email`/`username`/`phone` and `StaffUser.email`/`username`
    globally unique rather than unique-per-brand** - a deliberate
    simplification, not an oversight. There's no domain-based tenant
    resolution yet, so a pre-auth request (register, login) has no other
    way to know which brand it's for; keeping these global means login
    can still look a user up by identifier alone and just read `brandId`
    off the row it finds, with zero client-side changes to the login
    flow. `register` is the one place that genuinely needs an explicit
    `brandId` in the request (nothing else to infer it from), and staff
    bootstrap likewise takes an explicit `brandId` now (bootstrap is
    per-brand, not global - `StaffAuthService.bootstrapStaffUser` checks
    `count({ where: { brandId } })`, so brand B can still bootstrap its
    first ADMIN even after brand A already has staff). Revisit
    per-brand-unique identifiers once real tenant resolution exists.
  - Every staff-facing read/write is now scoped off the acting staff
    member's own `brandId`, carried in the `StaffJwtPayload` (and the
    player `JwtPayload`) rather than trusted from client input -
    `PamService` (bet listing/settlement - `settleSelection` 404s if the
    bet belongs to another brand, even if the id is guessed correctly),
    `MarketSuspensionService` (suspend/unsuspend/isSuspended -
    `unsuspend` 404s across brands the same way), `AuditLogService`
    (`record`'s `AuditActor` now carries `brandId`; `listEntries` is
    brand-scoped), and `ReportsService` (`getSummary`/`getStaffActivity`
    both brand-scoped - this incidentally made obsolete, but didn't
    replace, the `fileParallelism: false` fix from the previous piece,
    since brand-scoped tests can no longer race each other's global
    aggregates regardless of file parallelism).
  - `apps/backoffice` and `apps/master-backoffice` needed **zero UI
    changes** for this - brand scoping is entirely transparent through
    the JWT a staff member already has.
  - `apps/frontend` needed one small change: `register` now sends a
    `brandId`, read from a new `VITE_BRAND_ID` env var rather than
    asked of the player - each deployment of the player app is pinned to
    one brand (same reasoning as `apps/backoffice` being one-deployment-
    per-brand), defaulting to the seeded Default Brand's id for local
    dev/CI.
  - Verified with real Postgres + a real browser: created two real
    brands via the master backoffice, bootstrapped a separate ADMIN and
    registered a separate player for each, placed and settled a bet in
    each, then logged into `apps/backoffice` as each brand's ADMIN and
    confirmed - visibly, in the actual settlement screen - that each
    saw only their own brand's bet and never the other's. Independently
    confirmed via direct API calls that Reports and the Audit log were
    equally isolated per brand, and that brand A's ADMIN token got a 404
    (not just a UI-level hide) when attempting to settle brand B's bet
    directly by id.

  Still explicitly **not done**:
  - **No domain-based routing** - `Brand.domain` is stored but nothing
    resolves an incoming request's hostname to a brand yet, in either
    the backend or `apps/frontend`. This is why `apps/frontend` still
    needs `VITE_BRAND_ID` as a manual per-deployment config instead of
    inferring the brand from the hostname.
  - **Per-brand theming: now applied to `apps/frontend`'s Home page.**
    A new unauthenticated `GET /public/brands/:id` endpoint
    (`apps/backend/src/modules/master/public-brand.controller.ts`)
    returns the safe-to-expose subset of a brand's fields (name,
    logoUrl, themeMode, buttonColorHex, highlightColorHex) - needed
    because a player can browse before ever logging in, so this can't
    sit behind player/staff/master auth. `apps/frontend`'s
    `useBrandTheme` hook (`src/features/brand/useBrandTheme.ts`) fetches
    its own brand (via `VITE_BRAND_ID`) once on mount and applies it by
    setting `--color-brand`/`--color-highlight` as inline CSS custom
    properties on `<html>` and toggling `data-theme="light"|"dark"`;
    `apps/frontend/src/index.css` defines the base token set (dark by
    default, a `[data-theme='light']` override for the alternative) plus
    shared BETGER-derived component primitives (`.odd-btn`, `.btn-primary`,
    `.btn-ghost`, `.slash`, `.brand-flag`, `.font-display`) that use
    `color-mix()` to derive hover/deep shades from the two brand colors
    rather than needing a third stored color. Verified end-to-end with
    two real brands (different colors, different `themeMode`) rendering
    distinctly in an actual browser. Deliberately scoped to what the real
    `Match`/`Market`/`Selection` data model supports - the owner's
    delivered design mockups (a static HTML/CSS/JS prototype, not
    committed to the repo) assume live scores, per-sport tabs, boosted
    parlays, and a highlights feed that don't exist as real data yet, so
    Home only reskins the header, a lightweight featured-match hero
    (earliest kickoff, live matches prioritized), and the real upcoming
    match list.
  - **Login/Register/MatchDetail/NotFound: now fully reskinned too** -
    same tokens/primitives as Home (`.font-display`, `.brand-flag`,
    `.btn-primary`, `.slash`), verified visually in a real browser
    including both the live and pre-match badge states on MatchDetail.
    `CLAUDE.md` (repo root) now records this as a standing instruction:
    every player-facing page, new or existing, should match this system
    going forward rather than being left in the old plain-Tailwind style.
    Live/pre-match event pages, bet builder, boosts, and highlights
    remain to be built once their backing data models exist.
  - **Product flags aren't enforced anywhere** - `BrandProductFlag`
    records intent (cashout/bet builder enabled Y/N) but nothing in
    `pam` or elsewhere checks it, since there's no cashout or bet
    builder feature built yet regardless.
  - **No audit log for master actions** - unlike staff actions,
    brand-create/update/product-flag-change aren't recorded anywhere.
    The existing `AuditLogEntry` model is generic enough to extend to
    this later (it already has no FK to a specific actor table).
  - **Only one master account, no master-user management UI** -
    `bootstrapMasterUser` is the only way to create a `MasterUser`, and
    there's no `POST /master/...` equivalent to `StaffUsersController`
    for adding a second one. Matches "one login auth only" as described,
    revisit if that changes.
  - **Per-brand-unique player/staff identifiers** - see above; deferred
    alongside domain-based tenant resolution, not forgotten.
- ~~Odds feed ingestion/normalization layer~~ **Done**: built in
  `apps/odds-engine/src/providers/odds-api-io/` against a free-tier
  odds-api.io key (2 bookmakers, 100 req/hour, fetch-on-open only - no
  prices on the board list itself). Provider-specific code is isolated
  under that `providers/odds-api-io/` folder specifically so swapping in a
  licensed provider later doesn't touch the rest of the system - but the
  free tier's real limitations (partial bookmaker coverage, no sport/
  country/league browsing, no real-time push) mean a decent amount of this
  will need revisiting once a real provider is in place:
  - Real-time push: the odds-engine's WebSocket (`/odds`) still only
    sends a stub tick - actual market updates are HTTP-polled via
    `GET /events` / `GET /events/:id`, not pushed.
  - No hard rate-limit guard - only soft TTL caching (5min board list,
    2min per-match odds). Fine for one dev poking at it, not for real
    traffic.
  - No sport/country/league grouping on the board - flat list, sorted by
    a hand-picked "which competitions are probably covered" heuristic
    (see `PRIORITY_COMPETITION_KEYWORDS` in `events-service.ts`), not
    actual confirmed coverage data.
- **Player auth**: built (`apps/backend/src/modules/auth/`) - register/
  login/refresh/logout + JWT (access token in the response body, refresh
  token as an httpOnly/sameSite=lax cookie, rotated on every use), scoped
  to email/username + password only. Frontend side is wired too
  (`apps/frontend/src/features/auth/`, `pages/LoginPage.tsx`,
  `RegisterPage.tsx`) - access token kept in memory only, re-derived on
  page load via a silent refresh against the cookie. Two follow-ups
  intentionally left out of that piece:
  - Phone number is captured at registration but never verified - needs
    an SMS provider (Twilio or similar) decided, same category of gap as
    Payments above.
  - Biometric login (WebAuthn/passkeys) was discussed and deferred - no
    external provider needed for it, unlike the phone OTP piece, so it's
    a reasonable next auth piece whenever it's prioritized.
- ~~Bet placement / paper-money wallet~~ **Done - closes out Phase 3's
  goal**: "one real bet, placed by a logged-in user, on a live-updating
  odds board, working start to finish" now genuinely works end to end,
  verified in a real browser (not just unit tests) - register, place a
  combo bet from the bet slip, balance deducts correctly, session survives
  a reload. `User.balanceCents` (paper money, see Payments above) +
  `Bet`/`BetSelection` models (`apps/backend/src/modules/pam/`) support
  combo bets - one bet can carry multiple selections with combined odds,
  matching how the bet slip already worked since Phase 1.
  - ~~Settlement~~ **Manual settlement done** (Trading/Odds module's
    "settlement backoffice", Section 8.4): staff grade one selection at a
    time as `WON`/`LOST`/`VOID`/`OPEN`
    (`PATCH /admin/bets/:betId/selections/:selectionId/settlement`), the
    bet's overall outcome is recomputed from every selection's current
    status (one `LOST` leg kills the whole combo, `VOID` counts as 1.00
    odds and refunds its share), and re-settling (including reopening a
    leg as a correction) diffs against whatever was already credited
    rather than double-crediting. **Auto-settlement from real match
    results is still not built** - deliberately deferred, next up when
    prioritized.
  - ~~No real staff auth gates settlement~~ **Fixed**: settlement now
    requires a real staff JWT with ADMIN or TRADING role (see Backoffice
    staff auth above) - the admin-key stopgap only remains for the one
    bootstrap action of creating a staff account in the first place.
  - A real bug worth remembering the shape of: React StrictMode
    double-invokes effects in dev, which raced two concurrent
    `/auth/refresh` calls against the same single-use refresh token -
    the first rotated it, the second got a spurious 401 and looked like
    a broken session. Fixed with a shared in-flight promise
    (`inFlightRefresh` in `apps/frontend/src/lib/backendApi.ts`) so
    concurrent refresh attempts share one real request. Worth
    remembering this pattern for any other one-shot/rotating-token flow.
- **Redis**: provisioned in `docker-compose.yml` since Phase 0 but nothing
  in the backend actually talks to it yet (refresh tokens deliberately
  went to Postgres instead, to avoid wiring an unproven integration into
  the same piece as auth). Session/cache use cases may want it later.

---

## 11. Glossary (Domain Terms)

For a coding agent without sportsbook-industry background:

- **SP / CP** — Starting Price / Closing Price: the odds at which a market
  officially opens and closes; used to detect suspicious late price
  movement.
- **Liability** — the maximum amount the operator could lose on a given
  outcome/market/event if it wins.
- **Margin (overround)** — the built-in edge in a market's odds in the
  operator's favor.
- **Acca (accumulator) / Parlay** — a single bet combining multiple
  selections, all of which must win.
- **Bet builder / Same-game parlay (SGP)** — a bet combining multiple
  correlated selections within a single match.
- **Cashout** — allowing a player to settle a bet early, before the event
  finishes, at a calculated price.
- **GGR / NGR** — Gross/Net Gaming Revenue: core sportsbook profitability
  metrics.
- **Freebet** — a bonus-wallet instrument letting a player place a bet
  without staking their own cash.
- **Wagering requirement** — the amount a bonus must be "played through"
  before it (or its winnings) can be withdrawn as cash.
- **Arbitrage (in this context)** — players exploiting mispriced or
  stale odds, often across multiple accounts, to guarantee profit.

---

## 12. Immediate Next Action

Begin **Phase 0**: repo scaffolding, Docker Compose local environment, CI
pipeline, shared types package, and the internal event bus skeleton with
the events named in Section 9 stubbed out (even as empty interfaces) so
every later module has a contract to implement against from the start.
