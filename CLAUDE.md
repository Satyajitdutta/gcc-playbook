# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Company

**Legal name: PITHONIX AI INDIA PRIVATE LIMITED**
Brand name: Pithonix AI | Website: pithonix.ai | Email: info@pithonix.ai
Registered: Hyderabad, Telangana, India
Incorporated: 18th March 2026 | CIN: U62090TS2026PTC213220

Always use "PITHONIX AI INDIA PRIVATE LIMITED" in formal/legal documents.
Use "Pithonix AI" in UI, marketing copy, and general references.

## Writing Style Rules

- No em dashes anywhere — not in documents, proposals, emails, UI copy, or code comments. Use commas, full stops, or colons instead.
- Tone must be human, warm, and simple. Short sentences. Plain words. No jargon.
- Scan all written content for em dashes before finalising.

## Product Acronyms

- **JEET** — Just In Time Emotionally Empowered Technology (flagship ERP platform)
- **HARI** — Human Augmented Realistic Intelligence (AI-human augmentation framework, not an HR tool)
- **GOT** — Graph of Thought (proprietary multi-domain reasoning engine)
- **BOT** — Build-Operate-Transfer (deployment/commercial model)

## Project

**GCC Playbook** — India's first AI-native GCC Intelligence Platform
Live URL: gcc-playbook.pithonix.ai
GitHub: https://github.com/Satyajitdutta/gcc-playbook

## Commands

```bash
# Local dev (no build step — static HTML)
npx serve .

# Deploy — push to main, Vercel auto-deploys
git push origin main
```

## Architecture

Single-repo, no framework. Static HTML pages + Vercel serverless functions + Neon Postgres.

**CRITICAL: Vercel Hobby plan allows exactly 12 serverless functions.** The repo is currently at the limit. Do not add new files under `api/` without deleting one first. Consolidate new endpoints into existing handlers using action params or query params.

### Pages

| File | Route | Purpose |
|------|-------|---------|
| `index.html` | `/` | Main public site: hero, simulator, blog tab, contact |
| `gcc-admin.html` | `/gcc-admin` | Admin dashboard: leads, pipeline, blog management, signals |
| `crm.html` | `/crm` | CRM: OTP login, kanban pipeline, partners table, partner checklist |
| `partner-apply.html` | `/partner-apply` | Partner application form |
| `partner-portal.html` | `/partner-portal` | Partner self-service portal |
| `partner-deck.html` | `/partner-deck` | Partner pitch deck |
| `indus-whitepaper.html` | `/indus-whitepaper` | INDUS whitepaper |
| `stpi-proposal.html` | — | Standalone STPI proposal, print-to-PDF |
| `sbi-proposal.html` | — | Standalone SBI proposal |

### API Functions (all 12 slots used)

| File | Purpose |
|------|---------|
| `api/gemini.js` | Gemini proxy. Accepts `_model` field. Default: `gemini-2.5-flash` + `thinkingBudget:0` |
| `api/lead.js` | Lead + partner capture, M365 SMTP email, outreach engine trigger |
| `api/gcc-admin.js` | Admin CRUD: leads, pipeline, blog, signals. Also serves public blog via `GET ?blog=1` |
| `api/partner.js` | Partner application submission |
| `api/partner-approve.js` | Admin partner approval |
| `api/partner-edit.js` | Admin partner record editing |
| `api/partners-list.js` | Admin partners listing |
| `api/partner-portal.js` | Partner portal auth + data |
| `api/weekly-digest.js` | Weekly email digest (cron: Mon 04:00 UTC) |
| `api/gcc-weekly-report.js` | Weekly GCC report (cron: Mon 04:30 UTC) |
| `api/beyond-cure-signals.js` | Beyond CURE signal intelligence |
| `api/llms.js` | Serves `/llms.txt` |

### Database

Neon Postgres via `ADMIN_DATABASE_URL`. Tables are created with `CREATE TABLE IF NOT EXISTS` on first use inside each handler. Key tables: `gcc_leads`, `gcc_blog_posts`, partner tables.

`gcc_blog_posts` schema: `id, title, slug UNIQUE, excerpt, content, linkedin_copy, tags TEXT[], status (draft/scheduled/published), scheduled_at, published_at, created_by, created_at, updated_at`

### Blog System

- **Admin side** (`gcc-admin.html`): create/edit posts, seed 6 corridor intelligence draft posts, publish/unpublish, LinkedIn share modal (copies pre-written text + hashtags for manual paste).
- **Public side** (`index.html` Blog tab): fetches `GET /api/gcc-admin?blog=1`, renders cards, opens posts in an overlay modal (no separate routes).
- Blog CRUD actions in `gcc-admin.js`: `blog_list`, `blog_save`, `blog_publish`, `blog_unpublish`, `blog_delete`, `blog_seed`.

### Corridor Intelligence (INTERNAL ONLY)

`gcc-admin.js` contains a `CORRIDOR_INTEL` constant with Germany (30 large + 15 Mittelstand) and Japan (30 company) watchlists derived from proprietary reports. This data:
- Is NEVER exposed to any public endpoint, frontend, or API response.
- Is injected server-side only into Gemini prompts for `research` and `run_simulation` actions via `getCorridorContext(company, country)`.
- Must not appear in blog posts, public UI, or logs.

## Key Env Vars

| Var | Purpose |
|-----|---------|
| `GEMINI_API_KEY` | Shared Gemini key across all Pithonix Vercel projects |
| `SMTP_USER` | M365 sending address (e.g. info@pithonix.ai) |
| `SMTP_PASS` | M365 app password for SMTP_USER |
| `ADMIN_DATABASE_URL` | Neon Postgres connection string |
| `ADMIN_SECRET` | Auth token for gcc-admin.html and crm.html |

## Simulator — Critical Notes

- Model: `gemini-2.5-flash` + `thinkingConfig:{thinkingBudget:0}` — do NOT switch to gemini-2.5-pro (consumes all tokens internally, causes timeout).
- Pithonix fee in prompt: hard floor at 10-14% of Year 1 budget (30-40% above market). Never reduce this instruction.
- Internal +/-15% variance computed client-side after blueprint, sent to webhook only — never displayed publicly.
- City tier multipliers: Tier 1 = base, Tier 2 = 0.65x, Tier 3 = 0.52x — applied by Gemini inside the prompt.

## Email Pipeline

Form → `api/lead.js` → M365 SMTP → to: satyajitv.d@pithonix.ai, CC: info@pithonix.ai
Subject tags: `[Partnership Request]` for partners, `[GCC Lead Request]` for simulator leads.
GCC leads also call outreach engine: `pithonix-outreach-engine.vercel.app/api/research` — returns `{content:[{type:"text",text:"JSON string"}]}`. Must parse `content[0].text`.

## UI Theme

Deep forest green dark theme: `#081510` base, `#00d46e` accent. Fonts: Cormorant Garamond (serif headings) + Outfit (body). Applied consistently across all pages.
