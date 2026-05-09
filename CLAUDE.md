# CLAUDE.md — Resume Roaster project conventions

This is the project skill file. It is loaded on every session and read before any work in this repository. The conventions below override generic defaults.

`docs/product/SPEC.md` is the source of truth for *what* to build. `docs/architecture/` for *why* the architecture is the way it is. `docs/security/THREAT-MODEL.md` for security. `docs/product/PLAN.md` for build phasing. `docs/product/TONE_PROMPTS.md` for LLM personas. **This file is *how*.**

When `CLAUDE.md` conflicts with `docs/product/SPEC.md` or `docs/product/PLAN.md` on substance, those documents win. When it conflicts with general engineering instinct on style, this file wins.

---

## Repository structure

```
README.md, CLAUDE.md          ← stay at root
package.json, vercel.json     ← stay at root (Vercel)
api/                          ← serverless functions (Vercel routes from here — do not move)
lib/                          ← shared backend modules imported by api/*
public/                       ← static frontend; Vercel serves via rewrites in vercel.json
  index.html
  admin.html
docs/
  product/      SPEC.md, PLAN.md, TONE_PROMPTS.md
  architecture/ ADR-001…003 (formerly /adrs/)
  security/     THREAT-MODEL.md, SECURITY-AUDIT.md
  quality/      AUDIT.md, EVAL.md
dev/
  prompts.md    ← internal session log; not user-facing docs
```

If you move any of the above, update this section in the same change — drift between `CLAUDE.md` and the tree is the bug.

---

## Project conventions

- Vanilla JS only. No frameworks. No TypeScript. No build step. No bundler.
- Single-file frontend: `public/index.html`, `public/admin.html`. No component libraries. Vercel serves these via rewrites in `vercel.json`.
- Serverless functions: one file per route in `/api/`. Stateless. No shared mutable state.
- Use `fetch()` for HTTP. `async/await` everywhere. No `.then` chains.
- External libs limited to: PDF.js, Tailwind, Clerk, OpenAI SDK (or `fetch`), Upstash REST.

---

## UI conventions

### Visual identity

The product has two paired modes — both editorial, both warm, both anchored on burnt orange. Light is the default; dark mirrors it with the same restraint. **No third mode, no other palette.** The toggle is a small uppercase tracked text button in the page corner (no icon); the page also respects `prefers-color-scheme` on first load and persists the user's choice in `localStorage`.

**Light (default).**

- **Background:** cream `#F7F4EC`
- **Foreground:** near-black `#1a1814`
- **Accent:** burnt orange `#CC5500` — used sparingly, like punctuation, never decoration
- **Muted text:** warm grey `#8b8577`
- **Subtle borders:** `rgba(0,0,0,0.06)`

**Dark.**

- **Background:** deep warm-black `#14110d` (warm tone, not pure black)
- **Foreground:** cream `#F7F4EC`
- **Accent:** brighter burnt orange `#FF7733` — same role, retuned for contrast against dark
- **Muted text:** warm grey `#9a9285`
- **Subtle borders:** `rgba(255,255,255,0.08)`

### Typography

- **Headlines:** Georgia, serif. Letter-spacing `-0.02em` on large headlines. Italic for emphasis.
- **Body:** `-apple-system, "Segoe UI", Inter, sans-serif`
- **Case:** sentence case only. Never title case. Never ALL CAPS except small uppercase labels (chapter markers, footers).

### Layout

- Generous whitespace. 70% of any view should be empty.
- One idea per screen. Don't stack features visually.
- **No drop shadows. No gradients** (except inside the orb, if used). **No icons unless functional.**
- Borders thin and subtle (`border-[#0000000f]` style).
- Buttons: minimal, no `rounded-full`; slight `rounded-md`. No big colourful CTAs. Confidence in the type itself.

### Copy voice

- Funny, crisp, slightly dry. Never corporate.
- Direct address ("you," not "users").
- Specific over abstract ("save 30 mins," not "be more efficient").
- Slight self-awareness ("yes, this is a roast generator, what did you expect").
- Microcopy on errors should never blame the user. *"Hmm, that didn't work — try again?"* not *"Invalid input."*

---

## Code style

- Functions over classes.
- Early returns over nested `if`s (max 2 levels of nesting).
- `async/await` over `.then`.
- Validate input at the top of every function with clear error messages.
- Always return user-friendly error messages, never raw stack traces.
- Pure functions where possible; side effects isolated to handlers.
- Comments explain *why*, never *what* — the code shows *what*.

---

## API response shape

Frontend and backend follow this shape, except for **explicitly-streamed endpoints** (currently `/api/roast`, which streams the roast text as `text/plain` chunks for live rendering).

**Success (default):** `{ ok: true, data: <whatever> }`
**Success (streaming):** `text/plain; charset=utf-8` body, no JSON wrapper. The full body is the value (e.g., the roast text including its `<meta>` block at the top).
**Error (always JSON):** `{ ok: false, error: "user-friendly message", code: "ERROR_CODE_UPPER_SNAKE" }`. Errors are returned **before** streaming starts; if upstream fails mid-stream, the connection closes and the client sees a truncated body.

The frontend distinguishes by `Content-Type` header: `application/json` → parse and check `ok`; `text/plain` → read as a stream.

**Never expose:** API keys, internal IDs, stack traces, environment names, internal hostnames.

---

## Logging conventions

Every server-side log line goes through the single helper at `lib/log.js`:

```js
// lib/log.js
export function log(event, fields = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...fields,
  }));
}
```

Direct `console.log` / `console.error` / `console.warn` calls in `api/` and `lib/` are forbidden — the only place `console.log` appears is inside the helper itself.

### Required fields

`timestamp`, `event`, `status` (`started` | `success` | `error` | `denied` | `warning`).

### Optional fields

`userId`, `tokensUsed`, `durationMs`, `errorType`, `modelUsed`.

### Never log

- Resume content (full or partial — only token counts).
- API keys.
- Full request bodies.
- **End-user emails** — never. End-user emails are looked up at admin-render time from Clerk; they never enter logs.
- **Exception (Phase 4 / #031, extended in Phase 6 / #036):** the `admin:actions` Redis stream **and** `admin_action` log lines store the **operator's own email** (admin self-identifying in their own audit trail). End-user emails still never persist anywhere — actions targeting other users use opaque Clerk `userId` only. This is a deliberate carve-out for operator auditability; the privacy spine for end users is intact.

---

## When asked to add or modify UI

Always reference the visual identity above. **"Polish" means *more consistent with these conventions*, not more colourful or more decorated. Default to *removing* before adding.**

---

## When asked to add a feature

1. Check `docs/product/SPEC.md` — does this feature fit the spec?
2. If it doesn't fit, **ask before adding.** Don't silently expand scope.
3. Reference `docs/product/PLAN.md` — which phase does this belong to?

---

## When writing prompts for the LLM

Always edit prompts in `docs/product/TONE_PROMPTS.md`, not inline in code. Treat prompts as versioned product. When changing a prompt, bump the version and add a changelog entry.

---

## Forbidden

- Modal dialogs (we use inline UI states).
- Toast notifications (we use inline messages near the action).
- Loading spinners (we use thin progress bars or skeleton states).
- "Powered by" badges (the URL is enough).
- Any third theme beyond light and dark (the two are the design; nothing else).
