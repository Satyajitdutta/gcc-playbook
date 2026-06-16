// Pithonix GCC Playbook — Internal Lead Identification Tool (Admin only)
// Access restricted to @pithonix.ai email addresses via OTP login.
// Dedicated Neon Postgres (ADMIN_DATABASE_URL) — separate from the partner portal's DATABASE_URL.
//
// POST { action: 'send', email }                          — send OTP (pithonix.ai only)
// POST { action: 'verify', email, otp }                   — verify OTP → session token
// GET  (X-Admin-Token header)                              — list all leads
// POST { action: 'save_lead', ...fields } + X-Admin-Token  — create/update a lead
// POST { action: 'research', id } + X-Admin-Token          — AI research pass on a lead
// POST { action: 'run_simulation', id } + X-Admin-Token    — zone-aware tentative blueprint
// POST { action: 'delete_lead', id } + X-Admin-Token       — remove a lead

import { Resend } from 'resend';
import https from 'https';
import crypto from 'crypto';
import pg from 'pg';
const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

// Same designated-zone logic as the public simulator (index.html ZONE_MAP), kept in sync manually.
const ZONE_MAP = {
  'Healthcare & Life Sciences': { zone: 'Genome Valley', city: 'Hyderabad', type: 'Life Sciences & Pharma Cluster',
    benefit: '200+ resident life-sciences companies (incl. Novartis, GSK, Lonza), ~15,000-strong scientific workforce, plus the dedicated GCC zone at Bharat Future City for clinical analytics, drug design, and AI-led drug discovery.' },
  'Automotive / Manufacturing': { zone: 'Hardware Park (Shamshabad SEZ)', city: 'Hyderabad', type: 'Electronics & Hardware Manufacturing SEZ',
    benefit: '1,700-acre dedicated SEZ for electronics and hardware manufacturing with established supply-chain and logistics infrastructure.' },
  'BFSI (Banking, Financial Services, Insurance)': { zone: 'Financial District, Gachibowli', city: 'Hyderabad', type: 'BFSI & Fintech Corridor',
    benefit: 'Existing BFSI GCC concentration (incl. Vanguard, LPL Financial), Grade-A office supply, proximity to the Gachibowli talent corridor.' },
  'Technology / SaaS': { zone: 'HITEC City / Gachibowli', city: 'Hyderabad', type: 'IT & Software Corridor',
    benefit: 'Largest concentration of GCC and IT campuses in the state, deepest entry-to-mid talent pool for engineering roles.' },
};

// Deterministic, auditable probability score. Each factor is visible in signal_factors so the
// number can be defended to a government partner, not a single opaque LLM-judged figure.
// 25 signal types across 7 clusters. GOT-style scoring: signals from MORE DISTINCT CLUSTERS
// reinforce each other (a hiring post + a leasing report = a stronger combined story than
// either alone), so the diversity bonus rewards corroboration, not just a longer list.
const SIGNAL_CLUSTERS = {
  // Talent
  senior_hiring_post: 'talent', leadership_relocation_post: 'talent', glassdoor_jobs_surge: 'talent',
  linkedin_employee_count_jump: 'talent', niche_skill_hiring_burst: 'talent',
  // Real estate
  leasing_report: 'real_estate', sez_land_allocation: 'real_estate', coworking_largeblock_booking: 'real_estate',
  new_office_permit_filed: 'real_estate',
  // Financial / investor
  earnings_call_mention: 'financial', analyst_report_mention: 'financial', capex_guidance_increase: 'financial',
  sec_filing_india_mention: 'financial',
  // Government / policy
  government_pipeline_listed: 'government', tsipass_application_filed: 'government', sez_approval_listed: 'government',
  trade_mission_delegation: 'government',
  // Industry / peer
  competitor_already_landed: 'industry', conference_signal: 'industry', industry_association_membership: 'industry',
  vendor_rfp_india_scope: 'industry',
  // Media / PR
  news_article: 'media', press_release_india_expansion: 'media', executive_interview_mention: 'media',
  ma_or_jv_announcement: 'media',
  // Digital footprint
  domain_registration_india: 'digital', job_portal_company_page_created: 'digital', social_media_india_office_post: 'digital',
  other: 'media',
};
const SIGNAL_WEIGHTS = {
  senior_hiring_post: 30, leasing_report: 25, earnings_call_mention: 25, sez_land_allocation: 24,
  government_pipeline_listed: 20, tsipass_application_filed: 22, sez_approval_listed: 22, competitor_already_landed: 12,
  leadership_relocation_post: 22, analyst_report_mention: 18, capex_guidance_increase: 18, sec_filing_india_mention: 20,
  conference_signal: 15, industry_association_membership: 10, vendor_rfp_india_scope: 18, trade_mission_delegation: 16,
  press_release_india_expansion: 20, executive_interview_mention: 14, ma_or_jv_announcement: 18,
  glassdoor_jobs_surge: 14, linkedin_employee_count_jump: 14, niche_skill_hiring_burst: 16,
  coworking_largeblock_booking: 16, new_office_permit_filed: 18,
  domain_registration_india: 8, job_portal_company_page_created: 10, social_media_india_office_post: 8,
  news_article: 10, other: 5,
};
function scoreCandidate(c) {
  const signals = Array.isArray(c.signals) && c.signals.length ? c.signals : [c];
  const detail = [];
  const clustersSeen = new Set();
  let signalPoints = 0;
  for (const s of signals) {
    const type = s.signal_type || 'other';
    const points = SIGNAL_WEIGHTS[type] || SIGNAL_WEIGHTS.other;
    const cluster = SIGNAL_CLUSTERS[type] || 'media';
    clustersSeen.add(cluster);
    signalPoints += points;
    detail.push({ signal_type: type, cluster, points, named_explicitly: !!s.named_explicitly,
      recency_days: typeof s.recency_days === 'number' ? s.recency_days : 9999,
      source_count: Math.max(1, parseInt(s.source_count) || 1), evidence: s.evidence || '' });
  }
  const namedExplicitly = detail.some(d => d.named_explicitly);
  const namedPoints = namedExplicitly ? 15 : 0;
  const bestRecency = Math.min(...detail.map(d => d.recency_days));
  const recencyPoints = bestRecency <= 30 ? 20 : bestRecency <= 90 ? 10 : 0;
  const maxSources = Math.max(...detail.map(d => d.source_count));
  const sourcePoints = maxSources >= 2 ? 15 : 0;
  // Cross-cluster corroboration bonus: independent categories of evidence pointing the same way.
  const clusterDiversityPoints = clustersSeen.size >= 3 ? 20 : clustersSeen.size === 2 ? 10 : 0;
  const total = Math.min(100, Math.round(signalPoints / signals.length) + namedPoints + recencyPoints + sourcePoints + clusterDiversityPoints);
  return {
    total, signals_used: detail.length, clusters_used: Array.from(clustersSeen), cluster_diversity_points: clusterDiversityPoints,
    named_explicitly: namedExplicitly, named_explicitly_points: namedPoints, recency_days: bestRecency, recency_points: recencyPoints,
    source_count: maxSources, source_count_points: sourcePoints, signal_detail: detail,
  };
}

function callGemini(prompt, useSearch) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) { reject(new Error('GEMINI_API_KEY not configured')); return; }
    const reqBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, thinkingConfig: { thinkingBudget: 0 } }
    };
    if (useSearch) reqBody.tools = [{ google_search: {} }];
    const body = JSON.stringify(reqBody);
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (r) => {
      let raw = '';
      r.on('data', c => raw += c);
      r.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const text = data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;
          if (!text) { reject(new Error('Empty Gemini response')); return; }
          resolve(text);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function parseBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  return JSON.parse(await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); }));
}

async function requireSession(client, req) {
  const token = req.headers['x-admin-token'];
  if (!token) return null;
  const r = await client.query(
    'SELECT email FROM gcc_admin_sessions WHERE token=$1 AND session_expires_at > NOW()',
    [token]
  );
  return r.rows[0] || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!process.env.ADMIN_DATABASE_URL) { res.status(500).json({ error: 'Database not configured' }); return; }

  const client = await getPool().connect();
  try {

    if (req.method === 'GET') {
      const session = await requireSession(client, req);
      if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const showArchived = req.query && req.query.archived === '1';
      const r = showArchived
        ? await client.query('SELECT * FROM gcc_admin_leads ORDER BY updated_at DESC')
        : await client.query("SELECT * FROM gcc_admin_leads WHERE status != 'Archived' ORDER BY created_at DESC");
      return res.status(200).json({ leads: r.rows });
    }

    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    let body;
    try { body = await parseBody(req); } catch { res.status(400).json({ error: 'Invalid JSON' }); return; }
    const { action } = body;

    // -- OTP: send (pithonix.ai only) --
    if (action === 'send') {
      const email = (body.email || '').trim().toLowerCase();
      if (!email.endsWith('@pithonix.ai')) { res.status(403).json({ error: 'Access restricted to pithonix.ai accounts' }); return; }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000);
      // Drop any pending (unverified) OTP rows for this email, then issue a fresh one
      await client.query(`DELETE FROM gcc_admin_sessions WHERE email=$1 AND session_expires_at IS NULL`, [email]);
      await client.query(
        `INSERT INTO gcc_admin_sessions (token, email, otp_code, otp_expires_at)
         VALUES ($1, $2, $3, $4)`,
        [crypto.randomBytes(16).toString('hex'), email, otp, expires]
      );

      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'Pithonix GCC Platform <info@pithonix.ai>',
          to: email,
          subject: `Your GCC Lead Admin Code: ${otp}`,
          html: `<div style="font-family:Arial,sans-serif;background:#0a0f1e;color:#f1f5f9;padding:32px"><div style="max-width:420px;margin:0 auto;background:#0d1426;border-radius:12px;padding:28px;text-align:center"><p style="color:#94a3b8;font-size:12px;letter-spacing:2px;text-transform:uppercase">GCC LEAD ADMIN</p><div style="font-size:36px;font-weight:700;color:#22c55e;letter-spacing:8px;margin:16px 0">${otp}</div><p style="color:#64748b;font-size:12px">Expires in 10 minutes.</p></div></div>`
        });
      }
      return res.status(200).json({ sent: true });
    }

    // -- OTP: verify --
    if (action === 'verify') {
      const email = (body.email || '').trim().toLowerCase();
      const otp = (body.otp || '').trim();
      const r = await client.query(
        'SELECT token, otp_code, otp_expires_at FROM gcc_admin_sessions WHERE email=$1 AND session_expires_at IS NULL ORDER BY created_at DESC LIMIT 1',
        [email]
      );
      if (r.rows.length === 0 || r.rows[0].otp_code !== otp) { res.status(401).json({ error: 'Invalid code' }); return; }
      if (new Date(r.rows[0].otp_expires_at) < new Date()) { res.status(401).json({ error: 'Code expired' }); return; }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 12 * 60 * 60 * 1000);
      await client.query(
        `UPDATE gcc_admin_sessions SET token=$1, session_expires_at=$2, otp_code=NULL WHERE email=$3 AND token=$4`,
        [sessionToken, tokenExpires, email, r.rows[0].token]
      );
      return res.status(200).json({ token: sessionToken, email });
    }

    // -- public_stats: no auth required, called from the public site's live tracker --
    if (action === 'public_stats') {
      const r = await client.query(
        `SELECT COUNT(*)::int AS detected_count, COALESCE(AVG(probability_score),0)::int AS avg_score, MAX(created_at) AS last_scan
         FROM gcc_admin_leads WHERE status IN ('Detected','Researched','Simulated')`
      );
      const landed = await client.query(`SELECT COUNT(*)::int AS landed_count FROM gcc_admin_leads WHERE status = 'Landed'`);
      return res.status(200).json({
        tracked_count: r.rows[0].detected_count,
        avg_probability: r.rows[0].avg_score,
        last_scan: r.rows[0].last_scan,
        landed_count: landed.rows[0].landed_count,
        signal_types: Object.keys(SIGNAL_CLUSTERS).filter(s => s !== 'other').length,
        clusters: 7,
      });
    }

    // -- everything below requires a valid session --
    const session = await requireSession(client, req);
    if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }

    if (action === 'save_lead') {
      const f = body.fields || {};
      if (body.id) {
        const r = await client.query(
          `UPDATE gcc_admin_leads SET company_name=$1, industry=$2, country=$3, functions_needed=$4,
             year1_fte=$5, timeline=$6, top_priority=$7, source_notes=$8, status=$9, updated_at=NOW()
           WHERE id=$10 RETURNING *`,
          [f.company_name, f.industry, f.country, f.functions_needed, f.year1_fte, f.timeline, f.top_priority, f.source_notes, f.status || 'New', body.id]
        );
        return res.status(200).json({ lead: r.rows[0] });
      }
      const r = await client.query(
        `INSERT INTO gcc_admin_leads (company_name, industry, country, functions_needed, year1_fte, timeline, top_priority, source_notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [f.company_name, f.industry, f.country, f.functions_needed, f.year1_fte, f.timeline, f.top_priority, f.source_notes, session.email]
      );
      return res.status(200).json({ lead: r.rows[0] });
    }

    if (action === 'delete_lead') {
      await client.query('DELETE FROM gcc_admin_leads WHERE id=$1', [body.id]);
      return res.status(200).json({ success: true });
    }

    if (action === 'research') {
      const r = await client.query('SELECT * FROM gcc_admin_leads WHERE id=$1', [body.id]);
      if (r.rows.length === 0) { res.status(404).json({ error: 'Lead not found' }); return; }
      const lead = r.rows[0];
      const industryOptions = Object.keys(ZONE_MAP).concat([
        'Retail / E-Commerce', 'Consumer Packaged Goods (CPG)', 'Energy & Utilities', 'Professional Services', 'Telecom / Media', 'Other'
      ]);
      const prompt = 'You are a GCC market analyst at Pithonix researching a probable lead BEFORE any company contact has been made. '+
        'Using what is publicly known or reasonably inferable about this company (its sector, scale, and how similar companies have approached India GCCs), '+
        'fill in the dropdown fields a Pithonix analyst would otherwise have to guess manually. Be honest about uncertainty, do not invent named deals, dates, or quotes.\n\n'+
        'Company: '+lead.company_name+'\n'+(lead.source_notes?'Signal / source notes: '+lead.source_notes+'\n':'')+'\n'+
        'Return ONLY valid JSON in this exact shape:\n'+
        '{"industry":"one of: '+industryOptions.join(' | ')+'","country":"likely HQ country","functions_needed":"comma-separated list of likely functions, e.g. Technology Hub (Engineering, AI/ML, Cloud, DevOps), Data & Analytics (BI, Data Engineering)","year1_fte":"a range like 80-150 FTEs","timeline":"one of: Fast-Track (9-12 months) | Balanced (18-24 months) | Phased (24-36 months)","top_priority":"one of: Cost Leadership | Innovation Engine | Talent Access | Risk Diversification","research_summary":"150-250 word honest brief explaining the reasoning behind each field above, ending with one line on what must be confirmed directly with the company before this is treated as fact","confidence_level":"High/Medium/Low"}';
      let text;
      try { text = await callGemini(prompt); }
      catch (e) { res.status(502).json({ error: 'Research generation failed: ' + e.message }); return; }
      const m = text.match(/\{[\s\S]*\}/);
      let parsed;
      try { parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
      if (!parsed) { res.status(502).json({ error: 'Could not parse research output' }); return; }
      const r2 = await client.query(
        `UPDATE gcc_admin_leads SET industry=$1, country=$2, functions_needed=$3, year1_fte=$4, timeline=$5, top_priority=$6,
           research_summary=$7, status='Researched', updated_at=NOW() WHERE id=$8 RETURNING *`,
        [parsed.industry || lead.industry, parsed.country || lead.country, parsed.functions_needed || lead.functions_needed,
         parsed.year1_fte || lead.year1_fte, parsed.timeline || lead.timeline, parsed.top_priority || lead.top_priority,
         (parsed.research_summary || '') + (parsed.confidence_level ? '\n\nConfidence: ' + parsed.confidence_level : ''), body.id]
      );
      return res.status(200).json({ lead: r2.rows[0] });
    }

    if (action === 'discover') {
      const industryOptions = Object.keys(ZONE_MAP).concat([
        'Retail / E-Commerce', 'Consumer Packaged Goods (CPG)', 'Energy & Utilities', 'Professional Services', 'Telecom / Media', 'Other'
      ]);
      const signalList = Object.keys(SIGNAL_CLUSTERS).filter(s => s !== 'other').join(', ');
      const prompt = 'You are a GCC market analyst at Pithonix, scanning the open web RIGHT NOW for companies that are probable leads to set up a '+
        'Global Capability Centre (GCC) in India, with a bias toward Telangana/Hyderabad signals. Use real, current web search results. Do not invent companies or sources. Be fast and concise.\n\n'+
        'Possible signal types (7 clusters: talent, real_estate, financial, government, industry, media, digital): '+signalList+'.\n'+
        'For each company, report every distinct signal type you found real evidence for — a company with 2 signals from different clusters is a stronger lead than one with a single news_article.\n\n'+
        'Return ONLY valid JSON, no markdown: {"candidates":[{"company_name":"exact name, or a placeholder like \\"Unnamed European Aerospace Firm\\" if anonymized in the source",'+
        '"industry":"one of: '+industryOptions.join(' | ')+'","country":"HQ country if known",'+
        '"signals":[{"signal_type":"one of the types above","named_explicitly":true_or_false,"recency_days":number,'+
        '"source_count":number,"evidence":"1 short sentence, citing the source"}],'+
        '"source_urls":["url1"]}]}\n\n'+
        'Only include candidates and signals you found real evidence for. Return an empty candidates array if nothing credible was found. Limit to at most 4 candidates, max 3 signals each, to keep this fast.';
      let text;
      try { text = await callGemini(prompt, true); }
      catch (e) { res.status(502).json({ error: 'Discovery failed: ' + e.message }); return; }
      const m = text.match(/\{[\s\S]*\}/);
      let parsed;
      try { parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
      if (!parsed || !Array.isArray(parsed.candidates)) { res.status(502).json({ error: 'Could not parse discovery output' }); return; }

      const existing = await client.query('SELECT LOWER(company_name) AS n FROM gcc_admin_leads');
      const existingNames = new Set(existing.rows.map(r => r.n));

      const inserted = [];
      for (const c of parsed.candidates) {
        if (!c.company_name || existingNames.has(c.company_name.toLowerCase())) continue;
        existingNames.add(c.company_name.toLowerCase());
        const factors = scoreCandidate(c);
        const evidenceNote = factors.signal_detail.map(d => d.evidence + ' [' + d.signal_type + ']').join(' | ');
        const r = await client.query(
          `INSERT INTO gcc_admin_leads (company_name, industry, country, source_notes, status, probability_score, signal_factors, source_urls, created_by)
           VALUES ($1,$2,$3,$4,'Detected',$5,$6,$7,$8) RETURNING *`,
          [c.company_name, c.industry || null, c.country || null, evidenceNote,
           factors.total, JSON.stringify(factors), (c.source_urls || []).join(', '), session.email]
        );
        inserted.push(r.rows[0]);
      }
      return res.status(200).json({ inserted, scanned: parsed.candidates.length });
    }

    if (action === 'run_simulation') {
      const r = await client.query('SELECT * FROM gcc_admin_leads WHERE id=$1', [body.id]);
      if (r.rows.length === 0) { res.status(404).json({ error: 'Lead not found' }); return; }
      const lead = r.rows[0];
      const zoneMatch = ZONE_MAP[lead.industry] || null;
      const fteNum = parseInt(lead.year1_fte) || 80;
      const prompt = 'You are an India GCC setup cost expert at Pithonix.ai. Generate a TENTATIVE, lead-generation-stage GCC Setup Blueprint for internal use, '+
        'to be shared with Telangana government as a probable-lead case, not a client deliverable. Use current India market rate ranges.\n\n'+
        (zoneMatch ? 'TELANGANA DESIGNATED ZONE MATCH: For a '+lead.industry+' company, the fit is '+zoneMatch.zone+' in '+zoneMatch.city+' ('+zoneMatch.type+'). Why: '+zoneMatch.benefit+' Populate designated_zone in the output with this.\n\n' : 'No specific designated zone mapped for this industry yet; set designated_zone to null and use the city-tier model.\n\n')+
        'LEAD PROFILE (assumed, not confirmed by the company):\nCompany: '+lead.company_name+'\nIndustry: '+(lead.industry||'unknown')+'\nHQ Country: '+(lead.country||'unknown')+
        '\nFunctions Needed: '+(lead.functions_needed||'unknown')+'\nYear 1 FTE: '+(lead.year1_fte||'80-150')+'\nTimeline: '+(lead.timeline||'Balanced (18-24 months)')+
        '\nTop Priority: '+(lead.top_priority||'unknown')+'\nResearch Notes: '+(lead.research_summary||'none yet')+'\n\n'+
        'Return ONLY valid JSON: {"city_primary":"city","city_primary_reason":"2 sentences","designated_zone":'+(zoneMatch?'{"name":"'+zoneMatch.zone+'","type":"'+zoneMatch.type+'","benefit":"1-2 sentences"}':'null')+
        ',"setup_budget_total_usd":number,"year1_fte_estimate":number,"govt_pitch_summary":"3-4 sentences written for a Telangana government audience: why this company is a probable lead, what zone fits, and what the state should highlight when courting them","confidence_level":"High/Medium/Low — how confident this assumed profile is without direct company confirmation"}';
      let text;
      try { text = await callGemini(prompt); }
      catch (e) { res.status(502).json({ error: 'Simulation failed: ' + e.message }); return; }
      const m = text.match(/\{[\s\S]*\}/);
      let bp;
      try { bp = m ? JSON.parse(m[0]) : null; } catch { bp = null; }
      if (!bp) { res.status(502).json({ error: 'Could not parse simulation output' }); return; }
      await client.query(
        'UPDATE gcc_admin_leads SET blueprint_json=$1, designated_zone=$2, updated_at=NOW() WHERE id=$3',
        [JSON.stringify(bp), bp.designated_zone ? bp.designated_zone.name : null, body.id]
      );
      return res.status(200).json({ blueprint: bp });
    }

    res.status(400).json({ error: 'Invalid action' });

  } catch (e) {
    console.error('gcc-admin error:', e.message);
    res.status(500).json({ error: 'Request failed' });
  } finally {
    client.release();
  }
}
