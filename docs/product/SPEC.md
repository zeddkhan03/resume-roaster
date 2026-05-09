# SPEC.md — Resume Roaster

**Status:** v1 (reconciled with PLAN.md 2026-05-07)  ·  **Owner:** Zaid Khan  ·  **Date:** 2026-05-07  ·  **Demo:** 2026-05-10

---

## Purpose

Resume Roaster is a single-page web app that takes a developer's PDF resume and returns a structured, opinionated roast in one of three tones, written as if by a senior tech recruiter who has read ten thousand resumes and is mildly tired. It exists for early-career engineers who want a sharp, honest second opinion that surfaces the vagueness, missing evidence, and recycled phrasing that quietly hurts them — and it exists, secondarily, as the worked example for a twenty-five-minute talk on the engineering discipline that separates a thirty-minute toy from a shippable product.

## What it does

- Accepts a PDF resume via drag-drop or file picker. Parses it **client-side** with PDF.js — the server only ever sees extracted text.
- Offers three tones — **Gentle**, **Honest**, **Brutal** (default: Honest) — selected by versioned prompt templates in `TONE_PROMPTS.md`.
- On "Roast me," streams a roast back to the page **token-by-token** as it's generated. The roast is organized **section by section** to mirror the resume's actual sections — `## The Summary section`, `## The Experience section`, `## The Skills section`, etc. — bracketed by an opening At-a-glance / 60-second-test / First-impression and a closing Verdict / Read / Friend-advice that varies by persona. Plain English throughout: short sentences, common words, easy to read on a phone.
- Closes every roast with a **persona signature** in italics — *"— anjali mehrotra, sr. recruiter, mumbai"* / *"— vikram reddy, sr. staff engineer"* / *"— marcus chen, hiring manager, seattle"*.
- Loading state shows a **rotating editorial verb** ("vikram is sussing…", "germinating…", "coalescing…", "plotting…") plus a small pulsing dot. No spinner.
- Three click-to-load **sample resumes** above the upload (buzzword bingo / actually-good / first job) so anyone can demo without a PDF in hand.
- A **"see what we asked anjali"** link below the disclaimer expands to reveal the persona's full system prompt, fetched from `/api/prompt?tone=…`.
- A **save-to-PDF** affordance in the post-actions row uses the browser's native print dialog with a print-only stylesheet.
- Uses OpenAI `gpt-5.4-mini` for generation, with a documented fallback to `gpt-4o`. The active model is admin-switchable at runtime.
- **Requires a Clerk sign-in** for every roast. There is no anonymous tier.
- Enforces a per-user token quota: **30,000 tokens per UTC day per user**, individually overrideable by the admin.
- Provides an **admin dashboard at `/admin`**, gated by Clerk authentication plus a server-side single-email allowlist (`ADMIN_EMAIL`), that exposes today's load (total users, total tokens, estimated USD cost), a per-user usage table sorted by tokens, per-user quota set/reset, global model switch, **live tone-prompt editing** (Redis overrides the file at runtime), abuse-guard toggles (file-size, prompt-injection, output-cap), and a global demo-mode toggle. Every admin action is appended to a Redis audit stream `admin:actions`.
- Ships a **Demo mode**: three pre-generated roasts (one per tone) bundled with the app, served via `?demo=gentle|honest|brutal`, automatically when the LLM upstream returns 5xx three times in a 60-second window, or forced on globally by an admin — so the live talk demo cannot fail on stage.
- Renders an **editorial pull-quote** above the roast — the persona's single most cutting line, displayed in oversized italic Georgia. Sourced from the LLM's `<meta>` JSON in the same call.
- Renders an **analysis strip** above the roast prose: a one-line factual readout (word count · quantified-bullet ratio · sections detected · cliché count, all computed client-side from the resume text) plus a small editorial **radar chart** visualising the four LLM-derived param scores (`specificity`, `quantification`, `clarity`, `cliche_free`) on the same 1–10 scale.
- Renders an **"// in meme form" block** below the roast prose containing a short text-only viral-meme caption sourced from the LLM's `<meta>.meme_caption`. Plain text only; no images. Punchy, internet-native, persona-aligned.
- Includes a **self-aware disclaimer** below the output noting that this is an AI pretending to be a recruiter, that it can be confidently wrong, and that nothing here is a hiring promise, guarantee, or legal advice.

## What it explicitly does NOT do

This is the section that protects the product. Senior engineers name their boundaries before pressure arrives, so the team can defend them when feature requests start landing. Each line below is a feature someone will reflexively suggest, and that we will reflexively decline.

**Storage and data.**

- **No server-side storage of resume text.** Ever. The text lives in function memory for the request lifetime and is gone the moment the response closes.
- **No model training on user content.** The OpenAI request explicitly opts out of training-data use, and we do not retain a copy ourselves.
- **No analytics, telemetry, or behavioural tracking against resume content.** Logs record request id, tone, model, latency, token counts, and outcome — never the resume, never the roast.
- **No vector embeddings, semantic search, or retrieval index over user resumes.**
- **No PII enrichment.** No name-to-LinkedIn lookup, no email enrichment, no employer scraping, no third-party identity resolution.
- **No recruiter contact-info collection.** We do not ask for the user's email, phone, or LinkedIn. Clerk handles auth; that is the only identity we ever hold.
- **No third-party trackers, pixels, or analytics SDKs.** Vercel-native logs only.
- **No persistence of generated roasts.** The roast streams to the client and is gone the moment the connection closes. There is no `/r/<id>` route, no share link, no roast history — by design.

**Adjacent product scope.**

- **No resume editor, builder, or generator.** We critique what you bring; we do not write resumes from scratch.
- **No cover-letter generation.**
- **No career advice beyond resume critique.** No "should I take this job?", no "is this offer fair?", no negotiation coaching.
- **No interview prep, behavioural-question coaching, or mock interviews.**
- **No company research, job-fit scoring, or "would this resume get me hired at X?" analysis.**
- **No application tracker, follow-up reminders, or outreach automation.**
- **No ATS-format preview or "will this pass the bot" linting.**

**Integrations.**

- **No LinkedIn, GitHub, portfolio-URL, or résumé-host ingestion.** PDF only.
- **No job-board integrations** — Indeed, LinkedIn Jobs, Wellfound, Glassdoor, and friends are all out.
- **No "Apply directly" buttons, affiliate links, or referral monetisation.**
- **No browser extension, IDE plugin, or Slack app.**
- **No public API, developer access, or webhooks.**
- **No email, SMS, or push delivery of roasts.** Browser only.

**Input handling.**

- **No vision or OCR.** Text-extractable PDFs only; image-only resumes get a clean "we couldn't read this" message.
- **No image, Word, or plain-text upload.** PDF only.
- **No batch upload, zip files, or folder ingest.** One PDF per request.
- **No multi-resume A/B comparison.**

**Output and UX.**

- **No video, audio, or "AI avatar" roast formats.**
- **No social-share cards or auto-generated images.**
- **No regenerate-with-different-tone on the same upload.** Forces fresh upload, eliminates tone-shopping abuse.
- **No per-section regeneration** ("rewrite just the Receipts").
- **No paid tier, "Pro" features, or upsells.** Free, capped, end of story.

**Account, identity, and admin.**

- **No accounts, profiles, or settings UI beyond Clerk's drop-in.** No avatars, display names, or bios.
- **No team or organisation mode.**
- **No public admin signup or self-serve admin promotion.** Admin access is a single hard-coded email in `ADMIN_EMAIL`, verified server-side on every admin request. Promotion is an env-var change and a redeploy.
- **No admin access to roast or resume contents.** Admins see counters, IDs, and metadata only — never bodies. The privacy spine holds even for the operator.
- **No multi-language support.** English in, English out.
- **No custom or user-defined tones.** Three curated, versioned tones; eval cost is linear in tone count.
- **No mobile or desktop native app, no browser extension.** Web only.

## Users & roles

- **Anonymous visitor.** Lands on `/`, can read the value proposition, but **cannot roast without signing in**. Clicking "Roast me" opens the Clerk modal.
- **Authenticated user (Clerk).** Can roast up to **30,000 tokens per UTC day** (admin-overrideable per user). No personal dashboard, no roast history — intentionally, because nothing is retained server-side.
- **Admin (operator).** A Clerk-authenticated user whose email matches `ADMIN_EMAIL`. Verified server-side on every admin request — Clerk JWT first, allowlist second. Has access to `/admin`, which exposes:
  - **Today's load** — total users, total tokens, estimated USD cost, demo-mode state, recent OpenAI failure count.
  - **Per-user usage table** — top 100 by tokens used, with set / reset controls per user.
  - **Model switch** — `gpt-5.4-mini ↔ gpt-4o`, written to `config:active_model`.
  - **Tone-prompt editor** — three textareas, written to `config:tone:<gentle|honest|brutal>`, overriding `TONE_PROMPTS.md` at runtime.
  - **Abuse-guard toggles** — file-size cap, prompt-injection guard, output-cap; default on, off-able for live demonstration.
  - **Demo-mode toggle** — flip the global flag that forces all `/api/roast` traffic onto cached responses.
  - **Recent admin actions** — last 50 entries from the `admin:actions` Redis stream.

  Admin **cannot** read roast bodies, read resume text (none is stored), promote other users to admin from the UI, or change retention rules. Anything beyond the bullets above is an env-var change and a redeploy — by design.

## Success criteria

The app ships on 2026-05-10 if and only if every item below is independently verifiable that day:

1. **End-to-end smoke.** A signed-in user in a fresh browser can land on `/`, drop a real PDF, pick a tone, and read a complete four-section roast within **60 seconds** — measured from first paint to last streamed token.
2. **Structural conformance.** The eval suite (Phase 8) reports **≥ 90 %** of generated roasts across all three tones contain all four sections in order, with at least three Receipts and three Rewrites.
3. **Concurrency.** Sixty simulated concurrent roasts in a five-minute window complete with **zero 5xx** responses (load test, Phase 10).
4. **Per-user quota.** A manual test that pre-sets `quota:user:<id>:<today>` to `30000` in Upstash receives a **429 with `code: QUOTA_EXCEEDED`** and a `resetAt` field on the next `/api/roast` call from that user, and the UI surfaces a non-shouty banner with the reset time.
5. **Security.** The Phase 9 audit closes with zero Critical or High findings against the threat model.
6. **Demo continuity.** With `OPENAI_API_KEY` deliberately invalidated, `?demo=honest` still serves a complete cached roast in under two seconds.
7. **Audit trail.** `../../dev/prompts.md` contains every prompt sent during the build, in order, with timestamps and one-line outcomes.
8. **Admin gate.** A non-admin authenticated user receives **403** on every `/api/admin/*` endpoint and a server-side redirect to `/` for `/admin`. The allowlist check is enforced server-side — never just a client-side hide.
9. **Operator privacy spine.** A manual test confirms that no admin endpoint returns roast or resume body content, even when explicitly requested. The strongest guarantee in the product survives even the operator.

## Out of scope (v1)

Deferred — not abandoned, just not before 2026-05-10:

- Multi-resume A/B comparison
- LinkedIn / GitHub / portfolio URL ingestion
- Recruiter or hiring-manager mode (employer perspective, different prompts)
- Regenerate-with-different-tone without re-uploading
- Per-section regeneration ("rewrite just the Receipts")
- Saved roast history including share links (`/r/<id>` route)
- Email or push delivery of roasts
- Server-side PDF parsing (only revisit if PDF.js misses too many real resumes)
- Paid tier with higher quotas
- Native mobile app, native desktop app, browser extension
- Multi-language tone presets (Spanish, Portuguese, French)
- Public landing-page metrics ("12,431 resumes roasted")
- Custom user-defined tones
- Admin role-management UI (env-var allowlist is sufficient for v1)
- Multi-admin RBAC with sub-roles (read-only, billing-only, etc.)
- Admin audit log stored beyond the bounded Redis stream (Vercel function logs cover this for v1)
- In-app TTL configuration (TTL is a code constant; tone prompts are admin-editable per Phase 4)
- Global daily cost ceiling (per-user quotas suffice for v1; revisit in v2 if user growth warrants)

## Constraints

**Tech (locked).** Single `public/index.html` (plus `public/admin.html`) with vanilla HTML, CSS, and JavaScript. Tailwind via CDN, PDF.js via CDN. No build step. No TypeScript. No React. Backend is Vercel serverless functions in `/api/*`, vanilla JavaScript. Auth via Clerk drop-in JS. Storage and quotas via Upstash Redis over REST. LLM is OpenAI `gpt-5.4-mini` with documented fallback to `gpt-4o`. Hosted on Vercel.

**Time.** Spec, ADRs, and threat model precede any code. Build, evals, and security audit complete by **2026-05-10**.

**Cost.** Bounded by the per-user token quota (30,000 tokens / UTC day) multiplied by active users. No global daily ceiling is enforced in v1; if user growth warrants, add one in v2 backed by the same Redis day-counter pattern.

**Privacy.** Resume text is never stored server-side; it lives in function memory for the request lifetime and is gone the moment the response closes. Roasts are not persisted server-side; they stream to the client and end with the connection. Logs contain request ID, tone, model, latency, token counts, and outcome — never resume text, never roast text, never plaintext IPs, never **end-user** emails. Quota keys are the opaque Clerk `userId`. **The admin dashboard does not break this spine for end users:** it surfaces counters and metadata only, never roast or resume bodies. End-user emails appear in the per-user usage table only at render time, looked up live from Clerk and never persisted. **Exception for the operator (Phase 4 / ../../dev/prompts.md #031):** the `admin:actions` Redis stream stores the operator's own email as the `actor` field — admin self-identifying in their own audit trail. Actions in the stream that target end users always use opaque Clerk `userId` only; no end-user emails ever land in any persisted store.

**Aesthetic (locked).** Three colours: cream `#F7F4EC`, near-black `#1a1814`, burnt orange `#CC5500` (used sparingly as accent). Two fonts: Georgia for headlines, system sans for body. No shadows, no gradients, no icons unless functional. Editorial whitespace. Copy is funny, crisp, slightly dry, never corporate. Reference: Stripe Press cover, not SaaS dashboard.

**Demo.** Must survive roughly sixty concurrent attendees during the 2026-05-10 talk; the cached-fallback Demo mode (PLAN.md Phase 4.5) covers upstream failures. The demo cannot fail on stage.
