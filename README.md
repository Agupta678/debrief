# Debrief

Paste messy meeting notes. Get back a **Stakeholder Update** — summary, decisions, owned action items, and open questions — you can copy or download and send as-is.

Live demo runs entirely client-side against a local heuristic engine by default, and against a Claude-powered `/api/extract` endpoint when deployed with an API key.

## Why this scope

See the [PRD](https://agupta678.github.io/debrief/prd.html) (or [`PRD.md`](./PRD.md)) for the full product requirements. Short version: Debrief deliberately ships **one** opinionated document template instead of a template picker. See PRD §2 and §7 for the reasoning and what's deferred to v2.

## Project structure

```
index.html            Landing page + the "Try it" tool's markup
app.js                 Front-end: theme toggle, hero demo, try-it tool, calls /api/extract with a local fallback
styles.css              All styling (design tokens for light/dark in :root)
lib/heuristic.mjs       Deterministic local extraction engine — used by app.js (browser) and benchmark/score.mjs (Node)
lib/document-schema.mjs Shared Zod schema + system prompt for the Claude endpoint
api/extract.js          Vercel serverless function — calls Claude, returns the document JSON
benchmark/fixtures.json Hand-written notes + expected-output fixtures
benchmark/score.mjs     Scores the heuristic engine (always) and the Claude endpoint (if ANTHROPIC_API_KEY is set)
```

## Local development

No build step — `index.html` is served as-is. Any static file server works, e.g.:

```bash
python3 -m http.server 8080
```

The "Try it" tool works without any setup: if `/api/extract` isn't available (no backend running, or the call fails), it falls back to the local heuristic engine automatically.

To exercise the real Claude endpoint locally, run it through the [Vercel CLI](https://vercel.com/docs/cli), which serves both the static files and the `api/` functions:

```bash
npm install
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY
npx vercel dev
```

## Deploying

This repo is zero-config for [Vercel](https://vercel.com/): static root files + an `api/` directory is Vercel's default convention, no `vercel.json` needed.

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Set the `ANTHROPIC_API_KEY` environment variable (and optionally `CLAUDE_MODEL`, default `claude-opus-5`) in the Vercel project settings.
4. Deploy.

If `ANTHROPIC_API_KEY` isn't set, `/api/extract` returns a 503 and the front-end transparently falls back to the local heuristic — the app still works, just without the Claude-quality extraction.

## Benchmark

```bash
npm install
npm run benchmark
```

Always scores the local heuristic engine against `benchmark/fixtures.json`. Also scores the live Claude endpoint if `ANTHROPIC_API_KEY` is set in your environment (this calls the real API and costs real usage — opt in deliberately).
