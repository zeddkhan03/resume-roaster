# SECURITY-AUDIT.md — pre-demo audit

**Status:** v1 · **Date:** 2026-05-08 · **Auditor:** Zaid Khan · **Reads:** `THREAT-MODEL.md`, `../product/SPEC.md`, `../product/PLAN.md`, `../../CLAUDE.md` · **Scope:** the production deployment at `https://resume-roaster-indol.vercel.app` after Phases 1 → 6 + 4.5 (per `../../dev/prompts.md` #001–#040).

This is the Phase 9 audit. SPEC §Success criteria #5 says: *"The Phase 9 audit closes with zero Critical or High findings against the threat model."* — that's the bar. Anything Medium or below is allowed to ship if accepted in writing here.

---

## Method

For each OWASP item in `THREAT-MODEL.md`:

1. Read the "Mitigations" the threat model spec'd.
2. Compare against shipped code via `grep`, file inspection, and a live HEAD on the production URL for response-header verdicts.
3. Verdict per item: **Pass** (mitigation present and working), **Gap** (spec'd, not shipped — finding), **N/A** (item out of scope), or **Accepted** (deferred per SPEC residual list, scope unchanged).

No automated scanning, no penetration testing — this is a senior-engineer line-by-line review against the model the project wrote *for itself*.

---

## Summary

| Severity   | Count | Items |
|------------|-------|-------|
| Critical   | **0** | — |
| High       | **0** | — |
| Medium     | **0** | M1 + M2 both **resolved** (#042) — see findings list at bottom for what shipped |
| Low / Accepted | 3 | Clerk JS not SRI-pinnable · Tailwind CDN versionless · CSRF delegated to Clerk |
| Pass       | 9 | A01, A02, A03, A05, A07, A08, A09 (full); A04 (per-user quota only — partial accepted) |
| N/A        | 1 | A10 SSRF |

**Sign-off:** Zero Critical, zero High, zero Medium after #042 fix-pass → meets `../product/SPEC.md §Success criteria #5` cleanly.

---

## A01 — Broken Access Control

**Spec.** Server-side Clerk JWT verification + email-allowlist check on every `/api/admin/*` route. `/admin` page makes no privileged decision client-side. No public roast IDs (no persistence per SPEC).

**Verdict: Pass.**

- `lib/admin-auth.js:11` does NFC-trim-lowercase email normalisation per the THREAT-MODEL spec.
- `requireAdmin` invocations per admin endpoint:
  - `api/admin/config.js` — 3 (GET, POST, fallback)
  - `api/admin/demo-mode.js` — 3
  - `api/admin/log.js` — 2
  - `api/admin/quota.js` — 2
  - `api/admin/usage.js` — 2
  All call sites verified gating their handlers.
- `public/admin.html` first action on load is `GET /api/admin/usage`; the page renders the 403 state when the server returns it. No client-side hide of admin-only data.
- Roast-share IDs (`/r/<id>`) — N/A. `../product/SPEC.md §"What it explicitly does NOT do"` removed roast persistence; no IDs to brute-force.

---

## A02 — Cryptographic Failures

**Spec.** All secrets in Vercel env vars, only `CLERK_PUBLISHABLE_KEY` permitted in client code. `.env*` gitignored. HTTPS + HSTS at edge.

**Verdict: Pass.**

- Client-side secret scan (`grep -E "OPENAI_API_KEY|UPSTASH_REDIS_REST_TOKEN|CLERK_SECRET_KEY|sk_(test|live)|sk-[a-zA-Z0-9]{32,}"` over `public/index.html` + `public/admin.html`): **clean.**
- `.env` / `.env.local` / `.env.*.local` covered in `.gitignore`.
- `git ls-files | grep -E "\.env"` returns empty.
- Live HEAD on `/`: `strict-transport-security: max-age=63072000; includeSubDomains; preload` — Vercel-default HSTS exceeds spec (1 year + preload).
- Fingerprint salt — N/A. The project pivoted to Clerk-userId-only quota keys per #011 reconciliation; no fingerprint hashing surface.

---

## A03 — Injection

**Spec.** Tone strict allowlist, resume text wrapped with delimiter and "treat as data" instruction, log injection prevented by `JSON.stringify`. No SQL, no shell.

**Verdict: Pass.**

- Tone allowlist enforced server-side at `api/roast.js:97-101`. Anything else returns 400 `INVALID_TONE`.
- Resume text concatenated as a *user* message with explicit prefix `RESUME TEXT:\n\n${resumeText}` (`api/roast.js` around line 175). System prompt is persona + base instructions; user prompt is the resume. Standard role separation.
- Phase 5 added `lib/injection.js` — 5 high-confidence injection patterns (`ignore_previous`, `system_marker`, `assistant_marker`, `disregard`, `system_brackets`). Soft-warn on hit, no block. Roast continues with an `EXTRA WARNING` prepend to the system prompt.
- Phase 6 routed all logs through `lib/log.js` which uses `JSON.stringify`. CRLF in any field is escaped automatically. Log injection impossible.
- No SQL surface (per `ADR-003`). No shell exec anywhere.

---

## A04 — Insecure Design

**Spec.** Three-layer rate limiting (per-IP burst, per-user daily, global ceiling). Body size cap. Cost ceiling = hard wall. Demo cache fallback.

**Verdict: Pass on per-user quota + filesize cap + demo cache. Accepted on per-IP burst and global cost ceiling (deferred to v2 per #011).**

- **Shipped:**
  - Per-user 30k-token daily quota (Phase 3) — `api/roast.js` quota gate + `lib/redis.js` `usage:{userId}:{YYYY-MM-DD}` keys with 24h TTL.
  - Filesize guard (Phase 5) — frontend 5 MB cap (`public/index.html` `handleFile`) + server-side 100k-char cap (`api/roast.js` filesize guard).
  - Demo cache fallback + circuit breaker (Phase 4.5) — `lib/demo.js` + `lib/circuit.js`. Auto-fallback on 3+ OpenAI 5xx in 60 s; admin toggle; `?demo=` query param.
- **Accepted as deferred (per SPEC §Constraints / #011):**
  - Per-IP burst limit (5 req / 60 s) — not implemented. Justification: Clerk auth gates all paid-cost paths, and the per-user daily quota bounds blast radius. v2 candidate.
  - Global daily cost ceiling — not implemented. Justification: per-user 30k × actively-roasting users is the de-facto bound; SPEC accepted no global ceiling for v1.

---

## A05 — Security Misconfiguration

**Spec.** Try/catch on every handler; clean `{ error: { code, message } }` responses (no stack); CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy via `lib/headers.js`; CORS lockdown on admin endpoints.

**Verdict: Pass on error hygiene. M1 finding on missing headers.**

- Stack-trace leakage scan (`grep -nE "err\.stack|\.stack\b|console\.error"` over `api/`, `lib/`): **clean.**
- Try/catch coverage on every handler that calls an external service:
  - `api/roast.js` — 8 try blocks (auth, quota read, quota write, OpenAI primary, fallback, mid-stream)
  - `api/usage.js` — 2 (auth, Redis read)
  - `api/admin/log.js` — 2 (auth, XREVRANGE)
  - `api/admin/demo-mode.js` — 2
  - `api/config-public.js` — 1
  - Admin `config.js` / `quota.js` / `usage.js` — 0 try blocks but no external calls that throw outside `await`s already wrapped in `requireAdmin` and `redis*` (which themselves swallow errors per `lib/config.js` design). Reviewed in audit and confirmed safe.
  - `api/clerk-config.js` / `api/prompt.js` — 0 try blocks. Reviewed: no external calls; only env-var reads and static module reads. Safe.
- Response shape — slight doc drift (INFO, not finding): `THREAT-MODEL.md §A05` spec'd `{ error: { code, message } }`; actual shape per `../../CLAUDE.md §"API response shape"` is `{ ok: false, error, code }`. Same principle (clean error, no stack, code attribute). `THREAT-MODEL.md` could be updated in lockstep but not blocking.
- **M1 finding (Medium): missing response headers.** Live HEAD on `/`:
  - `strict-transport-security` — present ✓
  - `content-security-policy` — **absent** ✗
  - `x-content-type-options` — **absent** ✗
  - `x-frame-options` — **absent** ✗
  - `referrer-policy` — **absent** ✗
  - `permissions-policy` — **absent** ✗ (THREAT-MODEL doesn't spec this; fine)
- **CORS** — no explicit `Access-Control-Allow-*` headers anywhere; relies on Vercel default (same-origin only). For our threat model (no public API, no third-party origins talking to us), same-origin default is correct. Pass.

**Recommendation for M1:** add a `headers` block to `vercel.json` covering all five:

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://*.clerk.accounts.dev; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data:; connect-src 'self' https://*.clerk.accounts.dev https://*.upstash.io https://api.openai.com https://api.clerk.com; frame-ancestors 'none'" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
    ]
  }
]
```

30 min including CSP debugging (the `'unsafe-inline'` is unfortunate but required by Tailwind CDN's runtime style injection — already documented in THREAT-MODEL.md as the ADR-001 cost we accept).

---

## A07 — Identification and Authentication Failures

**Spec.** Clerk handles brute force, JWT expiry, cookie hardening. NFC + lowercase + trim email normalisation. Fingerprint advisory only.

**Verdict: Pass.**

- Brute-force / credential stuffing — Clerk's responsibility (free tier includes bot detection on `/sign-in` + `/sign-up`). Project relies on this per ADR-002.
- JWT expiry — `verifyToken` from `@clerk/backend` validates `exp` on every request via JWKS. ~1-hour expiry default. No persistent sessions on our side.
- Email normalisation — `lib/admin-auth.js:11` `normaliseEmail`: `(e || '').trim().toLowerCase().normalize('NFC')`. Matches THREAT-MODEL spec exactly.
- Fingerprint surface — N/A. Project pivoted to Clerk-userId-only quota keys per #011; no fingerprint header read or accepted anywhere.
- New-user OAuth fix from #038 — `signUp.authenticateWithRedirect` handles transfer for both new and existing users. No security implication; usability fix.

---

## A08 — Software and Data Integrity Failures

**Spec.** SRI on PDF.js + Tailwind. Clerk SDK SRI accepted as residual. Server deps pinned; `npm ci`; `npm audit` pre-deploy.

**Verdict: M2 finding (Medium). Server dependency hygiene Pass.**

- **M2 finding (Medium): no SRI on PDF.js / Tailwind CDN scripts.**
  - `public/index.html:15` and `public/admin.html:15`: `<script src="https://cdn.tailwindcss.com"></script>` — no `integrity=`. **Already accepted** per `THREAT-MODEL.md §A08` (Tailwind CDN versionless URL, can't pin meaningfully).
  - `public/index.html:519`: `import * as pdfjs from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs'` — pinned version, no `integrity=`. ES-module imports don't accept `integrity` directly; would need a `<link rel="modulepreload" href="..." integrity="sha384-..." crossorigin="anonymous">` companion tag.
  - `public/index.html:520`: similar for the worker (`pdf.worker.min.mjs`).
- Server dependencies — `package-lock.json` committed, all top-level deps in `package.json` pinned without `^`/`~` (verified). `npm ci` is the deploy-time command. `npm audit --production` not part of an automated gate but cheap to run before deploy.
- Clerk SDK SRI — Clerk's CDN URL versions itself dynamically. Accepted per `THREAT-MODEL.md §"Threats we accept"` #3.

**Recommendation for M2:** **accept** as a "Threats we accept" addition mirroring Tailwind's reasoning — the modulepreload+SRI workaround is fiddly, and PDF.js is loaded from the same CDN class as Tailwind (cdnjs is tier-1 vendor-hosted). Alternatively, fix in ~45 min by adding modulepreload tags with computed SHA-384 hashes.

If we accept: add a 9th entry to `THREAT-MODEL.md §"Threats we accept"`:

> 9. **PDF.js bundle SRI not pinned.** ES-module dynamic imports don't carry an `integrity=` attribute; a `<link rel="modulepreload">` companion would work but adds maintenance cost on every PDF.js patch. Cdnjs is a tier-1 vendor-hosted CDN with the same trust profile we already accept for Tailwind (#8). Acceptable for v1.

---

## A09 — Security Logging and Monitoring Failures

**Spec.** One structured log line per request. Never resume text, roast body, plaintext IP, or end-user email. Cost-ceiling state visible at `/admin`.

**Verdict: Pass.**

- Phase 6 done — single `lib/log.js` helper, 14 callsites refactored. Closed event vocab (9 user-facing + 6 transient telemetry).
- Discipline check: `grep -rn "console\." api/ lib/` returns exactly one match (`lib/log.js:5` itself). No bypass.
- PII scan over log call sites: no field named `resumeText`, `roastBody`, `ip`, or end-user email is ever passed. Operator email carve-out for `admin_action` documented in `../../CLAUDE.md §"Logging conventions"` and `../product/SPEC.md §Privacy`.
- Cost-ceiling alerting — N/A (no global ceiling shipped per A04). `/admin` shows "today's load" total cost estimate as the visible signal.
- Demo-mode + circuit-breaker count visible in `/admin` (Phase 4.5).

---

## A10 — Server-Side Request Forgery

**Spec.** Not directly applicable — server fetches are to fixed endpoints (OpenAI, Clerk, Upstash), none derived from user input. PDF parsing client-side.

**Verdict: N/A.**

- Outbound calls confirmed: `https://api.openai.com/...` (OpenAI SDK), `https://*.upstash.io/...` (REST wrapper), `https://*.clerk.accounts.dev/...` (Clerk JWKS via `verifyToken`). All hostnames hardcoded or derived from env vars. No user-controlled URL ever passed to `fetch`.
- Future-proofing flag intact per `../../CLAUDE.md` SPEC-boundary contract: any move toward LinkedIn / portfolio URL ingestion reopens this document.

---

## Threats we accept (rescoped from THREAT-MODEL.md)

Confirming each is still in scope and reasoning still holds. **No drift.**

1. **Anonymous quota bypass** — N/A. No anonymous tier; all roasting requires Clerk sign-in. Bypass surface eliminated. (Stronger than original residual.)
2. **Prompt injection extracting `../product/TONE_PROMPTS.md`** — Still accepted. Phase 5 soft-warn reduces success rate; tone prompts are versioned product, disclosure embarrassing not breaching.
3. **Clerk JS not SRI-pinned** — Still accepted. Vendor-versioned bundle URL.
4. **CSRF delegated to Clerk** — Still accepted. JWT in `Authorization` header (set by Clerk client SDK); HttpOnly + SameSite=Lax cookies.
5. **Roast share links unauthenticated** — N/A. No share links shipped.
6. **Vercel project access unitary** — Still accepted. One-developer demo project.
7. **No formal DDoS mitigation** — Still accepted. Vercel edge handles volumetric; demo-cache fallback covers user-impact.
8. **Dependency supply-chain trust** — Still accepted. `npm ci` from pinned lock; no SBOM-level review.
9. **(Proposed) PDF.js bundle SRI not pinnable.** New addition to mirror #3 and #8. See M2 above. Decide before T-2.

---

## Findings list (severity-ordered)

| ID | Severity | Item | Status | Resolution |
|----|----------|------|--------|------------|
| M1 | ~~Medium~~ | Missing CSP + X-Content-Type-Options + X-Frame-Options + Referrer-Policy headers | **Resolved (#042)** | `vercel.json` `headers` block applies all four globally. Live verification: `curl -I` shows all headers present. CSP includes `'unsafe-inline'` for script-src (theme-init inline scripts) and style-src (Tailwind runtime injection) — documented as the cost we accept per ADR-001. |
| M2 | ~~Medium~~ | No SRI on PDF.js CDN script + worker | **Resolved (#042)** | Two `<link rel="modulepreload" integrity="sha384-..." crossorigin="anonymous">` tags in `public/index.html` head pre-fetch both files with integrity verification. Tailwind + Clerk CDN scripts remain accepted residuals (#3, #8) — `THREAT-MODEL.md §A08` updated in lockstep. |
| INFO | —      | Doc drift on error response shape (THREAT-MODEL says `{ error: { code, message } }`; ../../CLAUDE.md / actual is `{ ok: false, error, code }`) | Open | Update `THREAT-MODEL.md §A05` to match `../../CLAUDE.md`. Tiny edit. Not blocking. |

---

## Sign-off

`../product/SPEC.md §Success criteria #5`: *"The Phase 9 audit closes with zero Critical or High findings against the threat model."*

- Critical: **0** ✓
- High: **0** ✓
- Medium: 2 (both with explicit recommendations)
- Low / accepted: 3 (no scope drift)
- Pass: 7
- N/A: 1

**Audit passes.** Operator decision required on M1 (recommend fix) and M2 (recommend accept) before final demo deploy.

— *audit complete 2026-05-08T17:46Z. Sign-off pending operator decision on M1/M2.*
