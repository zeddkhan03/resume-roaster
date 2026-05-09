# ADR-001: Vanilla HTML/CSS/JS, no build step

**Status:** Accepted
**Date:** 2026-05-07
**Deciders:** Zaid Khan

## Context

Resume Roaster ships by 2026-05-10 and serves as the live worked example for a 25-minute talk to ~60 developers. Three forcing functions shape the stack decision:

1. **Audience comprehension.** The talk thesis is "vibe coding is easy, shipping is the bug." Anything in the demo that requires explaining a build pipeline, a hydration boundary, or a Next.js routing convention burns talk minutes that should go to the shipping discipline (specs, ADRs, threat model, evals). The fewer concepts to teach before the audience sees the product, the better.

2. **Error surface area.** A build step is a class of failures: dependency resolution, transpiler config, bundler quirks, framework version skew. Each is a possible failure mode on stage. The single most reliable production stack is the one with no build.

3. **Deploy speed.** Vercel deploys a single static `public/index.html` plus serverless functions in well under ten seconds. The talk demonstrates a deploy live; deploys need to be fast and visibly boring.

The default impulse — Next.js + React + TypeScript + Tailwind + shadcn — is technically excellent but optimises for an application Resume Roaster is not: long-lived, multi-page, multi-developer, type-rich.

## Decision

The frontend is a single `public/index.html` with vanilla HTML, CSS, and JavaScript. Tailwind is loaded from the CDN. PDF.js is loaded from the CDN. There is no `package.json` for the frontend, no bundler, no transpiler, no client-side type checker, no client-side test framework.

The backend is vanilla JavaScript Vercel serverless functions in `/api/*`. Each function is a single file with no shared build pipeline. Authentication uses Clerk's drop-in JS bundle (see ADR-002). Streaming uses native `fetch` with `ReadableStream`. State, where needed, is module-scope JS variables and `localStorage`.

## Consequences

**What we gain.**

- Zero build configuration. `git push` → live in under ten seconds.
- The audience can read every line of source on stage and follow it. No "trust the bundler" moments.
- The error surface is the runtime, only.
- Tailwind CDN gives us the design system without a compile step.
- Live edits during the demo are trivial: change a file, save, refresh.

**What we sacrifice.**

- **No componentisation in the React sense.** We rely on small HTML templates and DOM-walking helpers. As the app grows beyond a single feature this becomes painful — but the app is not allowed to grow (see SPEC, *What it does NOT do*).
- **No type safety.** TypeScript would have caught a class of mistakes that the eval suite (Phase 8) and the smoke test (Phase 10) now have to catch. We accept that trade and design those phases accordingly.
- **No ecosystem reach.** No `npm install some-react-thing`. Every CDN dependency is deliberate and pinned to a version.
- **Tailwind CDN is officially "not for production."** Performance is fine for a demo, but we accept a slower first paint than a compiled build would yield. NFR1 was softened to ≤ 1.5s for this reason.
- **Future migration cost.** If the product unexpectedly becomes real, migrating to a framework is real work. We accept that — the alternative is the product never ships and the talk is theoretical.

This is the load-bearing ADR. ADR-002 (Clerk drop-in) and ADR-003 (Upstash REST) are direct consequences of "no build step."
