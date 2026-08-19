# Debrief — Product Requirements Document

**Status:** Draft (v2 — narrowed scope)
**Owner:** Ashish Gupta
**Last updated:** 2026-08-18

---

## 1. Problem

Meetings produce decisions and commitments, but they live in scattered raw notes — bullet points, shorthand, half-sentences typed during the call. Nobody goes back and turns that mess into something a stakeholder who wasn't in the room can actually read. Commitments made in the room quietly die after the room empties.

## 2. Product

Debrief takes raw, messy meeting notes and turns them into **one clean, shareable document** — the kind you'd actually paste into a Slack message or email to stakeholders. Not a list of extracted chips: a document with a title, a plain-language summary, the decisions that were made, the action items (owner/due/status), and the open questions still hanging.

**Positioning:** *"Paste your notes. Get the update you were going to have to write anyway."*

### Why this scope, not the broader one

The niche is the **output**, not the extraction. General "AI meeting notes" tools (Otter, Fireflies, Fathom, Notion AI) already do transcription + summarization broadly and compete on breadth of integrations. Debrief stays narrow: it doesn't record, doesn't integrate with a calendar, doesn't manage a workspace. It does one thing — turn raw notes into the specific document format a stakeholder update needs — and does it well.

A user-selectable template gallery (v1's original idea) was considered and **deferred**. Shipping a template *picker* before proving one template earns trust dilutes the niche into "yet another AI notes tool with a template gallery." One strong opinionated default, refined until it's reliably good, is the actual differentiator. Template selection becomes a v2 feature once the default output is proven.

## 3. Goals for this phase

1. Ship one default document template — the **Stakeholder Update** — generated from raw notes via a Claude-powered extraction endpoint.
2. Make the output shareable: copy as Markdown, download as a `.md` file, no account or storage required.
3. Keep a deterministic local fallback (the existing heuristic engine, extended to produce the same document shape) so the tool degrades gracefully instead of going blank if the API call fails.
4. Track extraction quality with a small, checked-in benchmark rather than an unverified claim on the landing page.
5. Ship as a deployable app (package.json, serverless function, env-based config) — not a folder of static files run locally.

### Non-goals (this phase)
- Template picker / multiple document formats (deferred to v2 — see §7).
- User accounts, saved history, or multi-user workspaces.
- Any integration (Slack/email ingestion, calendar sync, Jira/Linear export, live transcription).
- Editing/re-ranking extracted items in the UI (accept/reject individual items, drag-to-reprioritize).
- Mobile app / browser extension.

## 4. Users

Anyone who leaves a meeting with a wall of raw notes and needs to produce a clean stakeholder-facing update without manually rewriting it. Single-purpose utility, not a workspace — no persona segmentation needed for this phase.

## 5. Document schema (the "Stakeholder Update" template)

```json
{
  "title": "string — short, specific (e.g. \"Q3 Roadmap Sync — Aug 18\")",
  "summary": "string — 2-4 plain-language sentences, the kind someone skimming would read first",
  "decisions": ["string — a decision that was actually made, not discussed"],
  "actionItems": [
    { "task": "string", "owner": "string (\"Unassigned\" if unclear)", "due": "string | null (kept as free text, e.g. \"Friday\", \"next Monday\" — not date-normalized in v1, see open questions)", "status": "blocking | pending | open" }
  ],
  "openQuestions": ["string — unresolved items, risks, or things still waiting on someone"]
}
```

This is the shape both the Claude endpoint and the local heuristic fallback must produce, so the rendering layer never needs to know which one ran.

## 6. Requirements

### 6.1 Extraction API
- **Endpoint:** `POST /api/extract` — Vercel Node serverless function.
- **Input:** `{ notes: string }`.
- **Output:** the document schema above, as JSON.
- **Implementation:** Anthropic TypeScript/JS SDK (`@anthropic-ai/sdk`), using `client.messages.parse()` with a Zod schema matching §5 (`output_config.format`) for guaranteed-shape structured output — not manual JSON-string parsing.
- **Model:** `claude-opus-5`, configurable via `CLAUDE_MODEL` env var.
- **Key handling:** `ANTHROPIC_API_KEY` read server-side only, never exposed to the client. This is the reason extraction must be a backend call, not client-side like the old heuristic.
- **Failure behavior:** on any API error (auth, rate limit, timeout, refusal), return a 5xx with a machine-readable error; the client falls back to the local heuristic rather than showing a blank state.

### 6.2 Local heuristic fallback
- Extended from the original action-item-only engine to approximate the full document shape: title (from the first short non-action line, else a default), a generated one-line summary, decisions (matched via decision-language patterns), action items (existing logic), open questions (existing "open" signal patterns plus lines ending in `?`).
- Always available, always instant, always client-side — this is what powers the hero's static demo panel too.

### 6.3 Quality benchmark
- `benchmark/fixtures.json` — a small, checked-in set of realistic raw-notes examples with hand-written expected documents, covering: clear ownership, implied ownership, no owner, explicit vs. relative due dates, no date, blocking/urgent language, and lines that should NOT be extracted as action items or decisions.
- `benchmark/score.mjs` — a Node script that runs the fixtures through the extraction logic and reports a simple accuracy score (action items found vs. expected, owner match rate, decisions found vs. expected). Runs against the local heuristic unconditionally; runs against the live Claude endpoint when `ANTHROPIC_API_KEY` is set.
- Output is a reproducible report, not a claim — this is what backs the "Built in the open" copy on the landing page.

### 6.4 Front-end
- The "Try it" tool renders a **document**, not a chip grid: title, generated/fallback badge, summary paragraph, Decisions list, Action Items list (existing card styling, reused), Open Questions list.
- Loading state while `/api/extract` is in flight (button disabled + label change).
- "Copy as Markdown" and "Download .md" actions in the output panel header — this is the actual "share with stakeholders" mechanism for this phase; no hosted links, no accounts.
- Silent fallback to the heuristic on API failure — the user sees a working document either way, with a small indicator of which engine produced it.
- Hero demo panel keeps using the static local heuristic (fixed canned example, no reason to spend a live API call rendering it on every page load).

### 6.5 Deployment
- `package.json` with `@anthropic-ai/sdk` and `zod` as dependencies (Vercel installs at build time — no build step for the static front-end).
- No `vercel.json` needed — static root files + `api/` is Vercel's default zero-config convention.
- `.env.example` documenting `ANTHROPIC_API_KEY` and `CLAUDE_MODEL`; `.env` already gitignored.
- `README.md` covering local dev, env setup, and deploy steps.

## 7. Deferred to v2 (not in scope now, but the design should not preclude them)

- **Template picker**: additional document shapes (e.g. "Status Report," "Decision Log," "Exec Summary") plus auto-detection of the best template from note content, as originally scoped. The schema in §5 is deliberately generic enough that a second template is an additive schema + prompt, not a rearchitecture.
- Date normalization (resolve "next Monday" to an ISO date against a reference date).
- Hosted/shareable link output instead of copy/download only.
- Rate limiting / abuse protection on the public endpoint (no auth currently planned — acceptable for a personal-project launch, revisit before any meaningful traffic).

## 8. Success criteria

- The Claude endpoint produces a document that a real stakeholder update could plausibly be pasted from, on real messy notes — not just the curated hero example.
- The benchmark script runs clean from a fresh clone and produces a report, satisfying the "tracked in the repo" claim already on the landing page.
- The app is deployable to Vercel with only an API key as required config.
