# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Company

**Legal name: PITHONIX AI INDIA PRIVATE LIMITED**
Brand name: Pithonix AI | Website: pithonix.ai | Email: info@pithonix.ai
Registered: Hyderabad, Telangana, India
Incorporated: 18th March 2026 | Companies Act, 2013 | Company limited by shares
CIN: U62090TS2026PTC213220
PAN: AAQCP8532M
TAN: HYDP24088B

Always use "PITHONIX AI INDIA PRIVATE LIMITED" in formal/legal documents (proposals, MoUs, contracts, footers).
Use "Pithonix AI" in UI, marketing copy, and general references.

## Writing Style Rules

- No em dashes anywhere. Not in documents, proposals, emails, UI copy, or code comments. Use commas, full stops, or colons instead.
- Tone must be human, warm, and simple. Write like a real person talking, not a consultant writing a report.
- Short sentences. Plain words. No jargon.
- Scan all written content for em dashes before finalising.

## Product Acronyms

- **JEET** — Just In Time Emotionally Empowered Technology (flagship ERP platform)
- **HARI** — Human Augmented Realistic Intelligence (the structural framework defining how AI Agents and Humans augment each other — not an HR tool)
- **GOT** — Graph of Thought (proprietary multi-domain reasoning engine)
- **BOT** — Build-Operate-Transfer (deployment/commercial model)

## Project

**GCC Playbook** — India's first AI-native GCC Intelligence Platform
Live URL: gcc-playbook.pithonix.ai
GitHub: https://github.com/Satyajitdutta/gcc-playbook

## Commands

```bash
# Local dev (no build step — static HTML)
# Open index.html directly in browser, or serve with:
npx serve .

# Deploy — push to main, Vercel auto-deploys
git push origin main
```

## Architecture

Single-repo, no framework. Two serverless API functions + one static HTML page.

- `index.html` — Entire frontend (~2000 lines). All sections, JS, and inline CSS in one file.
- `api/gemini.js` — Server-side Gemini proxy. Reads `GEMINI_API_KEY` env var. Accepts `_model` field to select model. Default: `gemini-2.5-flash` with `thinkingBudget:0` for simulator (fast, reliable).
- `api/lead.js` — Lead and partner capture. Sends email via M365 SMTP (`SMTP_USER`, `SMTP_PASS` env vars). Tags: `[Partnership Request]` or `[GCC Lead Request]`. To: satyajitv.d@pithonix.ai, CC: info@pithonix.ai. For GCC leads, also calls outreach engine and sends enriched follow-up email.
- `vercel.json` — Both functions have `maxDuration: 60`.
- `stpi-proposal.html` — Standalone STPI partnership proposal. Self-contained, print-to-PDF enabled.

## Key Env Vars (set in Vercel dashboard)

| Var | Purpose |
|-----|---------|
| `GEMINI_API_KEY` | Shared key used across all Pithonix Vercel projects |
| `SMTP_USER` | M365 sending address (e.g. info@pithonix.ai) |
| `SMTP_PASS` | M365 password or app password for SMTP_USER |

## Simulator — Critical Notes

- Model: `gemini-2.5-flash` + `thinkingConfig:{thinkingBudget:0}` — do NOT switch to gemini-2.5-pro (thinking model consumes all tokens internally → timeout → fallback)
- Pithonix fee in prompt: hard floor at 10–14% of Year 1 budget (30–40% above market). Never reduce this instruction.
- Internal ±15% variance computed client-side after blueprint, sent to webhook only — never displayed publicly.
- City tier multipliers: Tier 1 = base, Tier 2 = 0.65×, Tier 3 = 0.52× — applied by Gemini inside the prompt.

## Email Pipeline

Form → `api/lead.js` → M365 SMTP → to: satyajitv.d@pithonix.ai, CC: info@pithonix.ai
Subject tags: `[Partnership Request]` for partner forms, `[GCC Lead Request]` for simulator leads.
GCC leads also trigger outreach engine: `pithonix-outreach-engine.vercel.app/api/research` — returns `{content:[{type:"text",text:"JSON string"}]}`. Must parse `content[0].text`. Outreach emails sent as a second email.

## Assets

- `logo.png` — Pithonix AI logo (teal/blue wave mark). Used in proposal and site nav.

---

# Second Brain: Operating Manual

A self-improving knowledge base living at `knowledge-base/` in this repo.
Based on Andrej Karpathy's LLM Wiki pattern: the LLM writes and maintains everything. You read and explore.

## Where Things Live

```
gcc-playbook/                        <- workspace root (you are here)
  CLAUDE.md                          <- this file (operating manual)
  knowledge-base/
    raw/                             <- junk drawer. NEVER edited. Source of truth.
    raw/session-notes/               <- takeaways saved from our chats
    raw/pages/                       <- ALL content pages (every topic, entity, synthesis, summary)
    wiki/                            <- navigation + bookkeeping ONLY (3 files, nothing else)
      index.md                       <- table of contents pointing to raw/pages/
      log.md                         <- dated history of every operation
      processed.md                   <- registry of raw files already ingested
    outputs/                         <- finished briefings and reports
```

## Hard Rules

1. `wiki/` contains ONLY `index.md`, `log.md`, and `processed.md`. Nothing else ever goes in wiki/.
2. Every content page (topic, entity, synthesis, source summary) lives in `raw/pages/`.
3. Files in `raw/` are NEVER edited. They are the immutable source of truth.
4. To find what is NEW: compare files in `raw/` against `wiki/processed.md`. Never re-ingest a file already listed there.
5. `[[wikilinks]]` resolve by filename regardless of folder. `index.md` is always the master table of contents.

## The 5 Operations

### 1. INGEST: "add this"

When the user drops a link, file, or text and says "add this":
1. Save the raw source as-is into `raw/` (never edit it)
2. Read it and extract the key information
3. Write or update the relevant page(s) in `raw/pages/`
4. Update `wiki/index.md` (add any new pages to the table of contents)
5. Append a line to `wiki/log.md`
6. Record the raw file in `wiki/processed.md`

Only process files NOT already listed in `wiki/processed.md`. This is how the brain only ever processes what is new.

### 2. QUERY: "what do I know about ___"

When the user asks a question:
1. Read `wiki/index.md` to find relevant pages
2. Read those pages in `raw/pages/`
3. Synthesize a clear answer WITH citations to the source pages
4. If the answer is valuable, file it as a new page in `raw/pages/` so the brain gets smarter

The user can also say "save that" to file any answer as a new page.

### 3. DREAM SEQUENCE: "dream sequence"

A health check for the whole wiki. When triggered:
1. Scan `raw/` against `wiki/processed.md` and ingest any NEW files found
2. Check for contradictions between pages
3. Flag or fix stale and outdated claims
4. Find duplicate pages and merge them
5. Identify orphan pages (no inbound links) and wire them in or flag them
6. Note gaps worth filling (concepts mentioned but lacking their own page)
7. Append a summary line to `wiki/log.md`

Run this when the user says "dream sequence". Default cadence: weekly.
To run more often, just say it more often (e.g. "run dream sequence daily" as a reminder to yourself, or trigger it manually each session).

### 4. INDEX + LOG: kept current automatically

- `wiki/index.md`: update on every ingest and every "save that" query.
- `wiki/log.md`: append-only. One line per operation.

**Log format:**
```
## [YYYY-MM-DD] ingest - raw/filename.md
## [YYYY-MM-DD] query - What is X?
## [YYYY-MM-DD] dream - weekly lint pass
## [YYYY-MM-DD] session - session title
```

### 5. SESSION CAPTURE: "save this session"

When the user says "save this session" (or at the end of a substantive chat):
1. Write the key takeaways into `raw/session-notes/` as a new dated file (e.g. `2026-06-13-session.md`)
2. Update `wiki/index.md` if the session introduced a notable new topic
3. Append to `wiki/log.md`

## Processed Registry Format

Every entry in `wiki/processed.md` is one line:
```
raw/filename | YYYY-MM-DD | one-line summary
```

## The Self-Improving Rule

Every ingest AND every valuable query MUST:
- Update or create a page in `raw/pages/`
- Append a line to `wiki/log.md`

This automatic write-back is what makes the brain smarter with every single use.

## Dream Sequence: Scheduling Note

This knowledge base is hosted in a cloud environment (Claude Code on the web). Persistent cron jobs are not available here. The Dream Sequence runs on your command: just say "dream sequence" in any session. Weekly is the recommended cadence. To make it truly automatic when using Claude Code locally, add a weekly cron entry: `0 9 * * 1 cd /path/to/gcc-playbook && claude "dream sequence"` (every Monday at 9am).
