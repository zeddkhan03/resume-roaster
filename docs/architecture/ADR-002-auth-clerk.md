# ADR-002: Clerk for authentication

**Status:** Accepted
**Date:** 2026-05-07
**Deciders:** Zaid Khan

## Context

The auth requirement (SPEC §"Users & roles") is small but exact: one anonymous roast per device per 24h, then a Clerk session unlocks five roasts per UTC day, plus a hard-coded admin email allowlist. Sessions must be verifiable from any Vercel function with no shared state. The frontend is a single `public/index.html` with no build step (ADR-001), so anything requiring a React provider tree or a Next.js middleware layer is automatically out.

Three live alternatives were considered.

1. **Roll our own** — sessions in a cookie, password hashes in Redis, magic-link emails via a third-party. Cheapest in vendor cost, most expensive in time and risk. Auth bugs are the bugs that get you on Hacker News, and we have three days.

2. **NextAuth / Auth.js** — strong default, but the ergonomics couple to Next.js. In a no-build-step vanilla app the bindings stop being ergonomic and we end up reinventing half the integration anyway.

3. **Supabase Auth** — viable, but Supabase optimises for "I also want a Postgres from the same vendor." We don't (see ADR-003), and bringing Supabase in for auth alone is overpaying in concepts the audience has to track during the talk.

Forcing function: the demo is in three days. Shipping a correct auth flow — signup, sign-in, session refresh, server-side JWT verification, and an admin allowlist — in that window is not negotiable.

## Decision

We use Clerk's drop-in `<script>` bundle on the frontend, and verify Clerk's JWT server-side in every authenticated `/api/*` function via Clerk's published JWKS. Admin gating is a server-side check that the Clerk-published email is in the `ADMIN_EMAILS` env var.

We use exactly: the sign-in modal, the current-session JWT, and the email claim. Nothing else — not Organizations, not Clerk roles, not Clerk billing, not Clerk webhooks.

## Consequences

**What we gain.**

- An hour of integration, not a week. Drop-in `<script>` matches the no-build stack from ADR-001 exactly.
- Magic-link, password, and OAuth providers come in the box. The 60-person demo audience can sign in with whatever they prefer.
- Server-side JWT verification is offline (JWKS-cached); no live call to Clerk on the request hot path.
- Free tier covers 10,000 monthly active users — orders of magnitude above any plausible demo traffic.
- Password reset, suspicious-login detection, and bot protection are vendor-handled.

**What we sacrifice.**

- **Vendor lock-in.** Migrating off Clerk later means rewriting sign-in flows and re-issuing user IDs. Acceptable; the product is small enough that future migration is days, not weeks.
- **A second auth surface to threat-model.** Token theft, session fixation, and admin-allowlist bypass via display-name spoof are now part of our threat model (Phase 3). None are Clerk-specific risks, but Clerk is now where they live.
- **Cost if the product takes off.** Free tier ends at 10k MAU; paid plans start at $25/mo. Acceptable for the demo; flagged for any future scaling decision.
- **A small dependency on Clerk's UX choices.** Modal styling, copy, and error messages are theirs; we can theme but not fully restyle without leaving the drop-in and forfeiting the speed gain that motivated this ADR in the first place.
- **Status-page coupling.** A Clerk outage takes our sign-in flow offline. The free anonymous tier still works, which mitigates this for the talk but not for any future where authenticated users are the majority.

We are explicitly not using Clerk for anything beyond sign-in and the email claim. Anything more would invite scope creep we have no time for.
