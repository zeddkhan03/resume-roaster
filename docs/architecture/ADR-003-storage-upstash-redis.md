# ADR-003: Upstash Redis (REST) for storage

**Status:** Accepted
**Date:** 2026-05-07
**Deciders:** Zaid Khan

## Context

Resume Roaster needs to store exactly three things server-side:

1. **Quota counters** keyed by `hash(IP + fingerprint)` (anonymous) or `userId:YYYYMMDD` (authenticated), each with a TTL.
2. **Daily cost-ceiling counter** keyed by UTC date, TTL 24 hours.
3. **Generated roasts** keyed by 16-character random ID, value is the roast body, TTL 24 hours.

That is the entire data model. There is no relational structure, no joins, no need for query flexibility. Every access pattern is "look up this key, increment-or-set, optionally with a TTL."

Forcing functions:

- The frontend has no build step (ADR-001) and the backend is one-file-per-function on Vercel. Anything requiring a connection pool or a long-lived TCP connection is hostile to that environment.
- Vercel functions cold-start frequently; persistent database connections are an anti-pattern.
- TTL is the entire reason this data exists — quotas reset, ceilings reset, roasts expire. A storage primitive where TTL is first-class removes a class of cron jobs.

Three alternatives considered.

1. **Postgres (Vercel Postgres / Neon).** Overkill for three KV operations. Migrations, schema, pooling — all unnecessary for this data shape. We would build Redis-on-Postgres.
2. **Supabase.** Postgres-shaped, plus auth, plus storage. We are already not using it for auth (ADR-002). Bringing it in for storage alone is overpaying for concepts.
3. **In-memory** (Vercel function module scope). Lost on every cold start. Quotas would silently lie. Unacceptable.

Vercel KV was briefly considered; it is Upstash under the hood with a Vercel-branded API. We chose direct Upstash REST for portability and clearer documentation around the REST quirks we will encounter.

## Decision

We use Upstash Redis via its REST API. Three Redis primitives carry the entire data model:

- `INCR key` for quota and cost counters.
- `EXPIRE key seconds` (or `SETEX`) for TTLs.
- `SET key value EX seconds` for storing roast bodies.

Every Vercel function calls Upstash via the official `@upstash/redis` REST client. The client is HTTP-based — no persistent connection, no pool, no warmup penalty.

## Consequences

**What we gain.**

- One HTTP call per data operation. Works perfectly with stateless serverless functions.
- TTL is a primitive, not a cron job. Quota windows and the 24h roast TTL are guaranteed by the data layer.
- Free tier (10,000 commands/day) is comfortably above expected demo and post-demo traffic.
- Zero migration overhead. The data shape changes by changing the code that writes the keys.
- Deploys are independent of data. Schema is not part of the deploy artefact.

**What we sacrifice.**

- **No SQL.** Any future "show me the count of brutal-tone roasts last week" question requires app-level aggregation (loop over keys) or a separate analytics store. Acceptable — analytics on roast content is explicitly out of scope (SPEC, *What it does NOT do*), and counter-of-counters questions can be answered with parallel counter keys.
- **No relational integrity.** No foreign keys. We don't have any, and we are committing to data shapes simple enough to never need them.
- **Per-command cost model.** At very high traffic the command count becomes the budget item. The cost ceiling (200 roasts/day) bounds this; each roast generates ~5 Redis commands, well within free-tier headroom.
- **Vendor lock-in to Upstash.** Mitigated by the fact that the API is Redis. Any Redis-compatible host is a drop-in replacement; the code never names Upstash beyond the URL and token.
- **No ad-hoc query language for debugging.** Investigating a quota dispute means knowing the key shape. Key shapes will be documented in CLAUDE.md so future-us can debug at 2am.

This decision compounds with ADR-001 and ADR-002: each ADR so far chooses the option with the fewest concepts to teach the audience and the smallest set of moving parts to defend in production.
