# Resume Roaster

> your resume, honestly.

## What it is

A small app for the APL talk on May 10. Demonstrates what shipping looks like.

## Stack

- Vanilla HTML/JS, no frameworks
- Vercel serverless, OpenAI gpt-5.4-mini, Clerk auth, Upstash Redis quotas
- Single `public/index.html`, single `public/admin.html`

## Local dev

```bash
npm install
cp .env.local.example .env.local  # fill in keys
vercel dev
```

## Deploy

```bash
vercel --prod
```

## Repository layout

```
api/                    serverless functions (Vercel routes)
lib/                    shared backend modules
public/                 static frontend (index.html, admin.html)
docs/
  product/              SPEC, PLAN, TONE_PROMPTS
  architecture/         ADRs
  security/             THREAT-MODEL, SECURITY-AUDIT
  quality/              AUDIT, EVAL
dev/                    internal session log (prompts.md)
```

## Files

- [docs/product/SPEC.md](docs/product/SPEC.md) — what this app is and isn't
- [docs/product/PLAN.md](docs/product/PLAN.md) — phased build plan
- [CLAUDE.md](CLAUDE.md) — conventions for working on this with Claude
- [docs/product/TONE_PROMPTS.md](docs/product/TONE_PROMPTS.md) — the LLM personas (versioned)
- [docs/architecture/](docs/architecture/) — architecture decisions (ADRs)
- [docs/security/THREAT-MODEL.md](docs/security/THREAT-MODEL.md) — security thinking
- [docs/security/SECURITY-AUDIT.md](docs/security/SECURITY-AUDIT.md) — security audit
- [docs/quality/EVAL.md](docs/quality/EVAL.md) — manual eval checklist
- [docs/quality/AUDIT.md](docs/quality/AUDIT.md) — code audit findings
- [dev/prompts.md](dev/prompts.md) — the build journey, prompt by prompt

## Talk

Built live on May 10, 2026 at GDG Cloud Noida APL.
Slides: [link]
Recording: [link if available]
