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
- `api/lead.js` — Lead capture. Logs lead, fires Power Automate webhook (`LEAD_WEBHOOK_URL` env var), calls outreach engine, sends enriched payload.
- `vercel.json` — Both functions have `maxDuration: 60`.
- `stpi-proposal.html` — Standalone STPI partnership proposal. Self-contained, print-to-PDF enabled.

## Key Env Vars (set in Vercel dashboard)

| Var | Purpose |
|-----|---------|
| `GEMINI_API_KEY` | Shared key used across all Pithonix Vercel projects |
| `LEAD_WEBHOOK_URL` | Power Automate HTTP trigger URL → routes to info@pithonix.ai |

## Simulator — Critical Notes

- Model: `gemini-2.5-flash` + `thinkingConfig:{thinkingBudget:0}` — do NOT switch to gemini-2.5-pro (thinking model consumes all tokens internally → timeout → fallback)
- Pithonix fee in prompt: hard floor at 10–14% of Year 1 budget (30–40% above market). Never reduce this instruction.
- Internal ±15% variance computed client-side after blueprint, sent to webhook only — never displayed publicly.
- City tier multipliers: Tier 1 = base, Tier 2 = 0.65×, Tier 3 = 0.52× — applied by Gemini inside the prompt.

## Lead Pipeline

Form → `api/lead.js` → Power Automate → email to info@pithonix.ai
Outreach engine: `pithonix-outreach-engine.vercel.app/api/research` — returns `{content:[{type:"text",text:"JSON string"}]}`. Must parse `content[0].text`.

## Assets

- `logo.png` — Pithonix AI logo (teal/blue wave mark). Used in proposal and site nav.
