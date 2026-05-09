# PLAN.md — Resume Roaster Build Roadmap

**Status:** v1
**Owner:** Zaid Khan
**Date:** 2026-05-07
**Demo:** 2026-05-10
**Reads:** `SPEC.md`, `../architecture/`, `../security/THREAT-MODEL.md`

Six phases. Each is independently deployable, demonstrable, and testable. Stop after any one and the URL still serves something that doesn't 500. That is the point.

---

## Reconciliation

SPEC.md and PLAN.md were reconciled on **2026-05-07** (resolution log: `../../dev/prompts.md` #011). All seven deltas absorbed by SPEC; demo-mode re-added here as **Phase 4.5**; logging helper named **`log()`** consistently per ../../CLAUDE.md; emails never enter logs or the audit stream (privacy spine wins — emails appear only at admin-render time via live Clerk lookup).

---

## Phase 1 — v1: the deliberately vibe-coded toy

**Description:** End-to-end happy path on a single page — PDF upload, client-side text extraction, three tone buttons, roast button, streamed output. **No auth, no quotas, no real error handling.** This is the version a developer ships in 30 minutes. The version we put on stage so phases 2–6 have something to fix.

**Files:**

- `public/index.html` — single page; header, drop zone, tone buttons (×3), roast button, output panel; Tailwind via CDN, PDF.js via CDN with SRI; cream / near-black / burnt-orange palette per SPEC §Constraints.
- `lib/client/pdf.js` — wraps PDF.js. Exports `extractText(file): Promise<string>`.
- `lib/client/ui.js` — mounts the form, handles tone selection, calls `/api/roast`, renders streamed output.
- `api/roast.js` — vanilla Vercel function. Reads `{ resumeText, tone }`, picks a hard-coded tone prompt inline, calls OpenAI streaming, pipes to client. **No auth, no quota, no structured error path.**
- `vercel.json` — declares Node runtime for `/api/*`.
- `package.json` — root; deps so far: `openai`.
- `.env.local` — add `OPENAI_API_KEY`.

**Definition of done:**

1. `vercel --prod` deploys without error.
2. On a fresh browser, a tester drops a real PDF, picks any tone, clicks Roast, and a streaming roast appears within 60 s of click.
3. The four-section structure (Verdict / Receipts / Rewrites / This Week) is visible in output, even if not strictly enforced.
4. `public/index.html` source is under 200 lines (talk-readable on stage).
5. axe-core's automatic checks pass (contrast, label association). No icons / shadows / gradients per SPEC.
6. **Honest failure modes still present** — that's the point. No 401, no 429, no input validation. Phases 2–6 are what fix them on stage.

---

## Phase 2 — Auth (Clerk)

**Description:** Drop in Clerk's `<script>` SDK; gate the roast button on a Clerk session; verify the JWT server-side on every `/api/roast` call. No quotas yet — we just need to know who is calling.

**Files:**

- `public/index.html` — add Clerk `<script>` and `<meta name="clerk-publishable-key">`. Wrap the Roast button so an unsigned click opens the Clerk modal. Show user email in header when signed in.
- `lib/client/auth.js` — wrappers around `window.Clerk` for "is signed in?" and "get session token". Mounts the user button.
- `lib/server/auth.js` — `verifyClerkJWT(req): { userId, email } | 401`. Uses `@clerk/backend` `verifyToken()` against JWKS.
- `api/roast.js` — call `verifyClerkJWT` before any other work; on failure return `401 { error: { code: "UNAUTHENTICATED" } }`. Pass `userId` to OpenAI as the `user` field (abuse-correlation hint).
- `package.json` — add `@clerk/backend`.
- `.env.local` — add `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.

**Definition of done:**

1. `curl -X POST https://<deploy>/api/roast -d '{"resumeText":"...","tone":"honest"}'` (no auth) returns HTTP 401 with `{ error: { code: "UNAUTHENTICATED" } }`.
2. In a fresh browser, clicking Roast without a session opens the Clerk modal.
3. After signing in (any provider), the roast flow completes end-to-end and the server log shows the Clerk `userId`.
4. Signing out and clicking Roast re-opens the modal — server does not honour a stale token.
5. JWT verification happens via JWKS only; no live Clerk API call on the request hot path (verified: temporarily remove `CLERK_SECRET_KEY` and confirm verification still works).

---

## Phase 3 — Quotas (Upstash)

**Description:** Each authenticated user has a 30,000-token-per-UTC-day budget enforced server-side. Over-budget requests return 429 with the reset time.

**Files:**

- `lib/server/redis.js` — initialises `@upstash/redis` REST client from env vars. Single `redis` export.
- `lib/server/quota.js`:
  - `getRemainingTokens(userId): Promise<number>`
  - `chargeTokens(userId, amount): Promise<{ remaining, resetAt }>`
  - Key shape: `quota:user:<userId>:<YYYYMMDD>` (UTC). TTL: seconds-to-next-UTC-midnight.
  - Cap source: `config:user_quota:<userId>` if set, else `DEFAULT_USER_TOKEN_QUOTA` env (30,000).
- `api/roast.js` — call `getRemainingTokens` before OpenAI; if zero, return `429 { error: { code: "QUOTA_EXCEEDED", resetAt } }`. After OpenAI resolves, call `chargeTokens(userId, tokenIn + tokenOut)`.
- `lib/client/ui.js` — handle 429 with a non-shouty banner: "You've used today's quota. Resets at HH:MM UTC."
- `package.json` — add `@upstash/redis`.
- `.env.local` — add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `DEFAULT_USER_TOKEN_QUOTA=30000`.

**Definition of done:**

1. With a fresh user, `redis-cli SET quota:user:<id>:<today> 29900` then click Roast → request succeeds, counter ends near 30,000.
2. Next click returns `429 { error: { code: "QUOTA_EXCEEDED", resetAt: "<next UTC midnight>" } }`.
3. UI surfaces the reset time without blocking other UI.
4. The Redis key has a TTL between 1 and 86,400 seconds (verified via `TTL`).
5. `tokenIn + tokenOut` matches OpenAI's `usage` field within ±10 tokens.
6. No counter is incremented when the OpenAI call itself fails (verified by force-failing the upstream in dev).

---

## Phase 4 — Admin Dashboard (`/admin`)

**Description:** A Clerk-gated, allowlist-restricted admin page exposing today's load, per-user usage, model and tone-prompt configuration, and abuse-guard toggles — with every change written to a Redis audit stream.

**Files:**

- `public/admin.html` — single page in the same vanilla / editorial aesthetic. Sections: Today's load · Per-user usage table · Model switch · Tone-prompt editor (3 textareas) · Abuse-guard toggles · Recent admin actions. No client-side admin gating beyond cosmetic — every render comes from a `/api/admin/*` response.
- `lib/server/admin-auth.js` — `requireAdmin(req): { userId, email } | 401|403`. Calls `verifyClerkJWT`, then `normaliseEmail(claim.email) === ADMIN_EMAIL`.
- `lib/server/audit.js` — `logAdminAction({ actor, action, target?, before, after })`. Writes Redis stream `admin:actions` via `XADD admin:actions MAXLEN ~ 1000 * ...`.
- `lib/server/config.js`:
  - `getActiveModel()` — reads `config:active_model`, falls back to `DEFAULT_MODEL=gpt-5.4-mini`.
  - `getTonePrompt(tone)` — reads `config:tone:<tone>`, falls back to `TONE_PROMPTS.md` text loaded at cold start.
  - `getAbuseGuardFlag(name)` — reads `config:guard:<name>` (default `true`).
  - Each setter writes the value, calls `logAdminAction`, returns the new state.
- `api/admin/usage.js` — `GET`: `{ todayLoad: { totalUsers, totalTokens, estCostUsd }, perUser: [{ userId, email?, tokensUsed, lastSeenAt }] }`. Per-user list scans `quota:user:*:<today>` keys, capped at top 100.
- `api/admin/quota.js` — `POST { userId, action: "set"|"reset", value? }`. Writes `config:user_quota:<userId>` or deletes the day counter. Audit-logged.
- `api/admin/model.js` — `POST { model: "gpt-5.4-mini"|"gpt-4o" }`. Writes `config:active_model`. Audit-logged.
- `api/admin/tone.js` — `GET` returns `{ gentle, honest, brutal }` (Redis-or-file). `POST { tone, prompt }` writes `config:tone:<tone>`. Audit logs full before/after.
- `api/admin/guard.js` — `POST { name: "file_size"|"prompt_injection"|"output_cap", enabled: boolean }`. Writes `config:guard:<name>`. Audit-logged.
- `api/admin/audit.js` — `GET`: last 50 entries from `admin:actions` via `XREVRANGE`.
- `api/roast.js` — read model and tone prompt via `lib/server/config.js` (no longer hard-coded).
- `.env.local` — add `ADMIN_EMAIL`, `DEFAULT_MODEL=gpt-5.4-mini`.

**Definition of done:**

1. A non-admin authenticated user gets `403 { error: { code: "FORBIDDEN" } }` from every `/api/admin/*` endpoint and from `/admin` (page renders the 403 returned by its first XHR).
2. An anonymous (no Clerk session) user gets `401` from every admin endpoint.
3. Admin signs in, opens `/admin`, sees: total users today, total tokens, estimated USD cost (`tokens × price[active_model]`), and a per-user table sorted descending by tokens used.
4. **Quota adjust:** admin sets user `<id>` quota to 1,000; that user's next roast respects the new cap.
5. **Quota reset:** admin clicks reset on user `<id>`; their day counter returns to 0.
6. **Model switch:** admin flips to `gpt-4o`; the next roast's response log shows `model: gpt-4o` (verified in Vercel logs).
7. **Tone editor:** admin edits the `honest` prompt to include a recognisable marker phrase; the next `tone: honest` roast reflects the marker.
8. **Abuse-guard toggle:** flipping `prompt_injection` off causes the guard to no-op on the next request (verified by sending a known-injection payload). Flipping back on restores the block.
9. **Audit stream:** every action above produces an `admin:actions` entry with `{ ts, actor, action, target, before, after }`. Last 50 visible at `/admin`.
10. **Privacy spine holds:** no admin endpoint returns roast text, resume text, or any field that contains them. Verified by `grep -i 'resume\|roast.*body' api/admin/*.js` returning no matches in response shapes.

---

## Phase 4.5 — Demo mode (stage-failure safety net)

**Description:** Three pre-generated roasts ship with the app, served via `?demo=` query param, an admin-flipped global toggle, or an automatic OpenAI-circuit-breaker fallback. The talk demo cannot fail on stage.

**Files (reconciled per #039):**

- `lib/demo-roasts.js` — three pre-generated roasts (one per tone), produced against a fake resume. JS module exporting `DEMO_ROASTS = { gentle, honest, brutal }` as template-literal strings (template literals dodge JSON's no-multiline tax for ~500-word roasts; `_*` prefix would also collide with the Vercel route-exclusion pattern from #025).
- `lib/demo.js`:
  - `shouldServeFromCache(req, bodyTone): Promise<{ from, reason, tone } | null>` — checks `?demo=` first, then `config:demo_mode_forced`, then circuit-breaker state.
  - `getCachedRoast(tone): string` — reads from `DEMO_ROASTS`.
  - `streamCachedRoast(res, body)` — writes the cached body in 80-char chunks with 12ms pacing for realistic UX.
- `lib/circuit.js` — single-key counter (`circuit:openai:5xx`) with 60s TTL. Simpler than PLAN's bucketed sliding-window; same threshold (≥ 3) and same window (60 s) at the DoD level.
  - `recordUpstream5xx()` — `INCR circuit:openai:5xx`, `EXPIRE 60` on first set.
  - `isOpen(): Promise<boolean>` — returns `true` if `count >= 3`.
  - `getRecentFailures(): Promise<number>` — for admin-dashboard display.
- `api/admin/demo-mode.js` — `POST { enabled: boolean }` writes `config:demo_mode_forced`, audit-logged. `GET` returns current state plus circuit-breaker count.
- `api/roast.js` — call `shouldServeFromCache` after auth + quota + guards; on hit, stream cached body and skip OpenAI + skip quota increment. On OpenAI 5xx, call `recordUpstream5xx` so the *next* request gets diverted.
- `public/admin.html` — demo-mode toggle and "recent openai failures (60s)" indicator under the abuse guards section.
- `public/index.html` — read response header `X-Served-From-Cache: <reason>` and append an inline italic note above the roast (per ../../CLAUDE.md no-toast rule). The streamed response is `text/plain` so the served-from-cache signal flows through HTTP headers, not a JSON field.

**Definition of done:**

1. With `OPENAI_API_KEY` deliberately invalid, hitting `/api/roast?demo=honest` returns the cached honest roast (with simulated streaming) within 2 s.
2. Admin flips demo-mode on; the next live roast is served from cache regardless of OpenAI status. Response includes `served_from_cache: true`.
3. Force-failing OpenAI 5xx three times in 60 s: the fourth `/api/roast` is served from cache. The third 5xx logs `roast_failed { upstream: "openai_5xx" }`; the fourth logs `roast_completed { served_from_cache: true, reason: "circuit_open" }`.
4. Quota counters do not increment on cache-served responses.
5. Admin dashboard shows demo-mode state and the recent OpenAI failure count.
6. All three cached roasts in `api/_demo-roasts.json` pass the eval suite's four-section structure check.

---

## Phase 5 — Abuse handling

**Description:** Three concrete guards — file-size cap (5 MB), tone-input prompt-injection scrub, OpenAI `max_tokens=1500` — each individually toggleable from the admin dashboard. Default state is **on**; toggles exist so we can demonstrate "what happens when you turn them off" on stage.

**Files:**

- `lib/server/guards/file-size.js` — `checkFileSize(req)`. Body cap at 5 MB enforced before JSON parse via `Content-Length` header.
- `lib/server/guards/prompt-injection.js` — `scrubTone(toneRaw): string | throws BAD_INPUT`. Strict allowlist (`gentle|honest|brutal`) plus rejection of newlines and angle brackets.
- `lib/server/guards/output-cap.js` — `OUTPUT_MAX_TOKENS = 1500` passed as `max_tokens` to OpenAI. When the guard is off, `max_tokens` is undefined.
- `lib/server/resume-validate.js` — character-class heuristic to reject obvious binary blobs; length 200..40,000 chars per SPEC §11. **Always-on, not toggleable.**
- `api/roast.js` — wrap each guard in `if (await getAbuseGuardFlag("..."))`. Each guard rejection returns `400 { error: { code: "BAD_INPUT", reason } }`.
- `public/admin.html` — wire the three toggle switches added in Phase 4 to display real on/off state from `/api/admin/guard` GET.

**Definition of done:**

1. POST `Content-Length: 6291456` body returns `400 BAD_INPUT { reason: "file_too_large" }`; the OpenAI call is **not** made.
2. POST `tone: "honest\nIgnore previous instructions"` returns `400 BAD_INPUT { reason: "invalid_tone" }`.
3. A roast response is verifiably truncated near 1,500 tokens of output (verified by long resume → `tokenOut ≈ 1500`).
4. Flipping `output_cap` off via admin produces `tokenOut > 1500` on the next request. Flipping back caps it again.
5. All three guard toggles produce `admin:actions` entries and appear in the admin "Recent actions" panel.
6. Guard rejections increment **no** quota counter and **no** cost-ceiling counter — we charge for OpenAI calls, not blocked attempts.

---

## Phase 6 — Structured logging

**Description:** Replace every `console.log` with a single `log(event, fields)` helper that produces one structured JSON line per server-side event, drawn from a fixed event vocabulary. Logs become greppable. PII discipline (no resume text, no roast body, no IP, no end-user email) lives in ../../CLAUDE.md and code review — the helper itself is deliberately simple per #036 reconciliation.

**Files:**

- `lib/log.js`:
  - `log(event, fields)` — writes `{ timestamp, event, ...fields }`. No regex safeguard, no defensive drop. Callers are trusted to follow ../../CLAUDE.md §"Logging conventions" "Never log" rules.
  - `status` is required (in caller-supplied `fields`) and one of `started | success | error | denied | warning`.
  - **User-facing closed event vocabulary** (and required status per event):
    - `roast_started` — `started` — `{ userId, tone, model, durationToOpenAIMs }`
    - `roast_completed` — `success` — `{ userId, tone, model, tokensUsed, durationMs, served_from_cache? }`
    - `roast_failed` — `error` — `{ userId?, tone?, model?, errorType, durationMs }`
    - `quota_exceeded` — `denied` — `{ userId, currentUsage, limit }`
    - `auth_failed` — `denied` — `{ reason, route }`
    - `admin_action` — `success` or `denied` — `{ userId, email, action, ...action-specific fields }` (admin's own email is permitted here per the operator carve-out — same spirit as the `admin:actions` Redis stream; end-user emails never enter the log under any event)
    - `prompt_injection_detected` — `warning` — `{ userId, pattern }` (pattern name only, never surrounding text)
    - `guard_state` — `started` — `{ userId, guards: { filesize, injection, output }, modelInUse }` (start-of-work snapshot per roast)
    - `usage_check` — `success` — `{ userId, used, limit }`
  - **Non-vocabulary transient telemetry** (not part of the user-facing lifecycle, but still routed through `log()` for consistency): `quota_check_failed`, `quota_increment_failed`, `usage_redis_error`, `audit_write_failed`, `audit_read_failed`, `config_public_failed`. Operator-side noise events that fail-open without affecting the user.
- `api/roast.js` — `guard_state` after config load, `roast_started` after guards pass, `roast_completed` on stream close, `roast_failed` on every error path.
- `api/admin/*.js` — every endpoint wires through `lib/audit.js`, which emits `admin_action` log lines automatically alongside the `admin:actions` stream write. No per-endpoint logging changes needed.
- `api/usage.js` — `auth_failed` on JWT failures, `usage_check` on success.
- `api/config-public.js` — `config_public_failed` on Redis errors.
- All `console.log` calls in `api/` and `lib/` replaced with `log` (only `lib/log.js` itself contains `console.log`).

**Definition of done:**

1. `grep -rn "console\.log" api/ lib/` returns exactly one match (the helper itself).
2. A single successful roast in production produces exactly three log lines: `guard_state`, `roast_started`, `roast_completed`.
3. A blocked-by-quota request produces exactly one `quota_exceeded` line (no `guard_state`, no `roast_started`).
4. A guard rejection (`TEXT_TOO_LONG`) produces one `guard_state` plus one `roast_failed` with `errorType: 'text_too_long'`.
5. Vercel log search for `event:roast_failed` returns only failures, with no false positives from leaked `console.log`.
6. Every user-facing-vocabulary line carries a valid status (`started | success | error | denied | warning`); transient telemetry lines do too.
7. No log line contains `resumeText`, `roastBody`, `ip`, or end-user email — only admin's own email in `admin_action` lines.

---

## Phase order rationale

Each phase strengthens what the talk's argument requires:

- **Phase 1** establishes the toy. Without it, the talk has no "before."
- **Phase 2** introduces a person. Auth is the smallest change that turns "anyone can hit our OpenAI key" into "we know who is calling."
- **Phase 3** introduces consequences. A quota turns "we can be billed without limit" into "we are bounded."
- **Phase 4** introduces operability. Without admin tooling we cannot live-fix on stage; the dashboard is the second-act setpiece.
- **Phase 4.5** introduces survival. The cached-fallback safety net keeps the demo alive when OpenAI hiccups; without it, an upstream 5xx kills the talk.
- **Phase 5** introduces hardening. With admin in hand, abuse handling becomes a dial we can turn during the demo.
- **Phase 6** introduces visibility. Logs come last because they are the easiest to skip and the hardest to retrofit; doing them last is honest about where the discipline gap actually lives.

Stop after any phase and the deploy is shippable. That is the point.
