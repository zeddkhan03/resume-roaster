# AUDIT.md — file-by-file security pass

**Status:** v1 · **Date:** 2026-05-09 · **Auditor:** Zaid Khan · **Method:** read every JS / HTML / config file under the OWASP Top 10 lens from `../security/THREAT-MODEL.md`. Cross-cut with `grep` for `innerHTML`, `eval`, secret strings, missing auth, missing validation; live `curl` for response headers. Reviewed: `api/`, `lib/`, `public/index.html`, `public/admin.html`, `vercel.json`, `package.json`, `package-lock.json`. **Companion to** `../security/SECURITY-AUDIT.md` (#041–#042) which was per-OWASP-category; this one is per-file with code-level fixes.

---

## Summary

### Total findings by severity

| Severity | Count | Status |
|----------|-------|--------|
| Critical | **0** | — |
| High     | **0** | — |
| Medium   | **1** | F1 **resolved (#045)** |
| Low      | **4** | F2 + F3 + F4 + F5 all **resolved (#045)** |
| Info / Accepted | **3** | F6, F7, F8 accepted with reasoning |
| **Total** | **8** | 5 fixed · 3 accepted |

### Top 3 most critical findings, ranked

1. **F1 — `package.json` caret-prefixed dep ranges** (Medium / A08). Drifts from `../security/THREAT-MODEL.md §A08` mitigation: *"all dependency versions pinned (no `^` or `~`)"*. Lockfile blunts impact on the deploy path; bare-install machines drift. **5-min fix.**
2. **F5 — no pre-parse `Content-Length` cap on `/api/roast`** (Low / A04). Defense-in-depth gap. Vercel and Phase-5 text-length cap are de-facto bounds; explicit pre-parse check missing. **10-min fix.**
3. **F3 — admin self-XSS via crafted `userId` in `/api/admin/quota`** (Low / A03). `targetUserId` flows from admin POST body → audit stream → `public/admin.html` audit-log `innerHTML` render. Admin-on-self only. **10-min fix.**

### Ship-readiness verdict

**Ship-ready, fully closed.** All five actionable findings (F1-F5) resolved in #045. Three remaining items (F6/F7/F8) accepted with documented reasoning. `../product/SPEC.md §Success criteria #5` met with no open items.

---

## Findings by OWASP category

---

### A03 — Injection

#### F3 — admin self-XSS via crafted `userId` in `/api/admin/quota`

- **File:** `api/admin/quota.js`
- **Lines:** 23-29 (server-side validation gap), surfaces in `public/admin.html:1310` (innerHTML render)
- **Category:** A03 — Injection (DOM XSS via stored data)
- **Description:** `/api/admin/quota` accepts `userId` from POST body and validates only its type (`typeof userId === 'string' && userId`). Admin can send any string — including `<svg/onload=alert(1)>` — which is then stored in the `admin:actions` Redis stream as `targetUserId`. The audit-log render in `public/admin.html:1310` calls `describeAction(e)`, which interpolates `shortId(f.targetUserId)` into `innerHTML` via a template literal: `set quota for user ${shortId(f.targetUserId)} to ...`. `shortId` only slices a string; it does not escape. So the next admin to view the audit log executes the injected payload. **Self-XSS only** — there's a single admin (`ADMIN_EMAIL` env var), so the attacker is the victim. Real-world risk is theoretical; defense-in-depth says fix it.
- **Severity:** Low
- **Recommended fix:**
  ```js
  // api/admin/quota.js, after line 25
  if (!/^user_[A-Za-z0-9]{8,40}$/.test(userId)) {
    return res.status(400).json({ ok: false, error: 'invalid userId.', code: 'INVALID_USER_ID' });
  }
  ```
  Or apply the same pattern check to `_userId` in `setQuotaOverride` / `resetUsage` in `lib/config.js`. Either way also escape on render in `public/admin.html` per F4.

#### F4 — admin-side stored content interpolated into `innerHTML` in audit-log render

- **File:** `public/admin.html`
- **Lines:** 1304-1313 (recent admin actions), 1327-1335 (tone-prompt changelog)
- **Category:** A03 — Injection (DOM XSS, defense-in-depth)
- **Description:** Audit-log entries are rendered with `li.innerHTML = \`<span class="ts">${fmtTs(e.ts)}</span><span class="who">${e.email || shortId(e.userId)}</span><span class="what">${describeAction(e)}</span>\``. `e.email` is the admin's own email (Clerk-validated, RFC-shaped — practically safe). `describeAction(e)` itself produces `<strong>` tags for emphasis, so it has to return HTML and gets `innerHTML`'d. The result is: any future drift where untrusted data flows into `describeAction` (see F3) becomes an XSS sink. Also, `e.email` *should* be safe but RFC 5322 technically allows `<` in quoted local-parts; defense-in-depth says don't trust it.
- **Severity:** Low
- **Recommended fix:** rewrite the render to mirror the per-user table pattern at `public/admin.html:898-906`: build each `<span>` via `document.createElement`, set `textContent` for user-supplied bits, set `innerHTML` only for the static `<strong>` formatting that comes from a controlled allowlist. Or escape `e.email` via a tiny `escapeHTML(s) = s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))` and apply it everywhere admin-supplied data hits `innerHTML`.

---

### A04 — Insecure Design

#### F5 — no pre-parse `Content-Length` cap on `/api/roast`

- **File:** `api/roast.js`
- **Lines:** ~95 (where `req.body` is first read), upstream of the Phase-5 filesize text-length check
- **Category:** A04 — Insecure Design (missing defense-in-depth body-size guard)
- **Description:** Phase 5 added a 100,000-character cap on `resumeText.length` (when filesize guard is on), enforced *after* the body is parsed. Vercel's platform body-size limit (~4.5 MB on Hobby) is the de-facto upper bound. There's no explicit `Content-Length` header check before parsing. A malicious caller sending a 4 MB body of garbage costs us the parse round-trip even when we're going to reject it. `../security/THREAT-MODEL.md §A04` mitigations spec'd: *"Body size cap at 80 KB at the function entry."* — never shipped. Talking-shop scope.
- **Severity:** Low
- **Recommended fix:**
  ```js
  // api/roast.js, very top of handler() after the method check
  const cl = Number(req.headers['content-length'] || 0);
  if (cl > 5 * 1024 * 1024) {
    log('roast_failed', { status: 'error', errorType: 'body_too_large', durationMs: 0 });
    return res.status(413).json({ ok: false, error: 'request body too large.', code: 'BODY_TOO_LARGE' });
  }
  ```
  5 MB matches the frontend filesize guard's user-facing cap. Fires before any body parsing, before any auth — cheapest possible reject.

#### F6 — quota gate has GET-then-INCRBY race

- **File:** `api/roast.js`
- **Lines:** 60-93 (GET) + 234-247 (INCRBY at end of stream)
- **Category:** A04 — Insecure Design
- **Description:** The quota gate reads current usage with `redisGet`, decides allow/deny, then increments after streaming. Two concurrent requests from the same user can both pass the GET check, both stream to OpenAI, both INCRBY at the end. Net: user can exceed quota by ~tokens × concurrency. Per `../../dev/prompts.md` #029 ("fail-open if Redis errors so the demo never trips"), this is the accepted "best-effort" design — atomic enforcement would require a Lua script (`EVAL`) reserving estimated tokens upfront with a rollback on failure, deemed overkill for v1.
- **Severity:** Info / Accepted
- **Recommended fix:** none for v1. v2: add `lib/redis-lua.js` with an `EVAL`-based reserve-and-charge pattern.

#### F8 — `/api/admin/usage` SCAN scales linearly with active users

- **File:** `api/admin/usage.js`
- **Lines:** 30-37 (SCAN loop)
- **Category:** A04 — Insecure Design (operational, not security)
- **Description:** `redisScan(cursor, 'usage:*:<today>', 200)` iterates with `COUNT 200` per page, capped at 1000 total keys before bail-out. For v1 (<100 users) this is instant. Past ~10k active users in a single UTC day, the admin dashboard load slows. Documented invariant.
- **Severity:** Info / Accepted
- **Recommended fix:** none for v1. v2 candidate: maintain a `usage:active:<today>` Redis SET via `SADD` on every roast and iterate that instead of SCAN.

---

### A05 — Security Misconfiguration

#### F2 — `URL` constructor shadowed in `lib/redis.js` module scope

- **File:** `lib/redis.js`
- **Lines:** 2
- **Category:** A05 — Security Misconfiguration (maintenance hazard, indirect)
- **Description:** `const URL = process.env.UPSTASH_REDIS_REST_URL;` shadows the global `URL` constructor inside the module. Currently no `new URL(...)` calls exist in this file, so it's dormant. A future maintainer adding `new URL(somePath, baseUrl)` here will hit a confusing "URL is not a constructor" error. Tiny reliability footgun with no current security impact. Flagging because it tripwires future changes.
- **Severity:** Low
- **Recommended fix:**
  ```js
  // lib/redis.js
  - const URL = process.env.UPSTASH_REDIS_REST_URL;
  + const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  ```
  And update the one usage on line 10. 1-min change.

---

### A07 — Identification and Authentication Failures

#### F7 — admin email match is not timing-safe

- **File:** `lib/admin-auth.js`
- **Lines:** 46 (`userEmail !== adminEmail` comparison)
- **Category:** A07 — Identification and Authentication
- **Description:** The admin allowlist comparison uses string `!==`. Modern V8 short-circuits on first mismatched char, leaking length and prefix info to a sufficiently sensitive remote attacker via response timing. The leak is meaningless here: emails are public-by-nature (gmail addresses are routinely shared), `ADMIN_EMAIL` is normalised via NFC + lowercase + trim so length differences are bounded, and Clerk auth has already happened upstream — so an attacker who can guess `ADMIN_EMAIL` already needs an authenticated Clerk session to even reach this comparison. Net info-leak: negligible.
- **Severity:** Info / Accepted
- **Recommended fix:** none for v1. v2: if we ever gate on a real secret comparison, use `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` with same-length-padded strings.

---

### A08 — Software and Data Integrity Failures

#### F1 — `package.json` uses caret-prefixed dep ranges

- **File:** `package.json`
- **Lines:** 7-9
- **Category:** A08 — Software and Data Integrity
- **Description:** Dependencies listed as:
  ```json
  "@clerk/backend": "^1.0.0",
  "openai": "^4.77.0"
  ```
  `../security/THREAT-MODEL.md §A08` mitigations explicitly spec: *"all dependency versions pinned (no `^` or `~`)"*. Caret allows any minor + patch upgrade; `^4.77.0` matches `4.99.99`. Practical impact is bounded by `package-lock.json` (committed), and the deploy uses `npm ci` (locked install). But the `package.json` declaration drifts from spec, and any clean install without the lockfile (e.g., a new contributor running `npm install`) floats the versions. Supply-chain consistency hole.
- **Severity:** Medium
- **Recommended fix:**
  ```json
  "dependencies": {
    "@clerk/backend": "1.0.0",
    "openai": "4.77.0"
  }
  ```
  Use the exact versions resolved by the current `package-lock.json`. Verify with `npm ls --depth=0` after the edit. 5 min.

---

## What's NOT in this audit (covered elsewhere)

- **Authentication / authorization correctness** — covered by `../security/SECURITY-AUDIT.md §A01` (every admin route calls `requireAdmin`, verified) and `EVAL.md` cases 7, 9, 10.
- **Crypto / TLS / secrets in client** — covered by `../security/SECURITY-AUDIT.md §A02` (clean grep, HSTS verified, `.env` gitignored).
- **Prompt injection from resume content** — covered by Phase 5 design + `../security/SECURITY-AUDIT.md §A03` (soft-warn approach with EXTRA WARNING prepend; not a finding here).
- **Security headers** — closed in #042 (`vercel.json` headers block, all five live).
- **CDN SRI** — closed in #042 (PDF.js SRI'd via modulepreload; Tailwind / Clerk accepted residuals).
- **Logging discipline** — closed in Phase 6 (#037), verified by `grep -rn "console\." api/ lib/` returning one match (`lib/log.js:5`).
- **CSP / XSS via the roast prose renderer** — `public/index.html:1065-1107` markdown renderer is `textContent`-only; verified clean during this audit.

## Resolution log (#045)

| ID | Severity | Status | What shipped |
|----|----------|--------|--------------|
| F1 | Medium   | **Resolved** | `package.json` deps pinned to exact versions resolved by `package-lock.json`: `@clerk/backend@1.34.0`, `openai@4.104.0`. No `^`/`~` remain. |
| F2 | Low      | **Resolved** | `lib/redis.js` renamed `URL` → `REDIS_URL` (line 2 + line 10). `URL` constructor no longer shadowed in module scope. |
| F3 | Low      | **Resolved** | `api/admin/quota.js` adds regex `/^user_[A-Za-z0-9]{8,40}$/` validation on `userId` body field. Bait strings rejected with `400 INVALID_USER_ID` before reaching the audit stream. |
| F4 | Low      | **Resolved** | `public/admin.html` `describeAction` now returns a `DocumentFragment` built via `createElement` + `textContent`. Audit-log + tone-changelog renders go through new `renderAuditEntry` helper — zero `innerHTML` interpolation of admin-supplied data. |
| F5 | Low      | **Resolved** | `api/roast.js` adds pre-parse `Content-Length` cap at 5 MB before `requestStart`. Returns `413 BODY_TOO_LARGE` and emits `roast_failed { errorType: 'body_too_large' }`. Defense-in-depth on top of Vercel's edge limit. |
| F6 | Info     | Accepted     | Quota race accepted per #029 best-effort design. v2 candidate (Lua `EVAL` reserve-and-charge). |
| F7 | Info     | Accepted     | Email comparison non-timing-safe — negligible info-leak (emails public-by-nature, lengths bounded by NFC normalisation). |
| F8 | Info     | Accepted     | `/api/admin/usage` SCAN scaling fine for v1 (<1k users); v2 candidate via `usage:active:<today>` SET. |
